import Dexie, { type Table } from "dexie";

/**
 * Persistent store for the files attached to an in-progress seller listing.
 *
 * The listing form mirrors its text state into localStorage so a seller can
 * minimize or reload and keep working. That JSON cannot hold a `File`: the
 * object URLs in `imageItems` are only valid for the page that created them,
 * and a `File` serialised to JSON comes back as `{}`. Sellers therefore lost
 * every photo on reload and had to re-select them, which is the single most
 * common way a long listing gets abandoned.
 *
 * IndexedDB is the only browser store that accepts `Blob`s. Dexie is already a
 * dependency (see `indexedDBCache.ts`), so this reuses the same library in a
 * separate database, leaving the versioned cache schema untouched.
 *
 * Blobs are keyed per seller draft, so two sellers on the same device never see
 * each other's files and a draft can be cleared in one call.
 */

/** How long an untouched draft's files are kept before they are swept. */
const MEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ListingMediaKind = "image" | "descriptionImage" | "video" | "doc";

export interface ListingMediaRecord {
  /** `${draftKey}::${kind}::${itemId}` */
  id: string;
  draftKey: string;
  kind: ListingMediaKind;
  itemId: string;
  file: Blob;
  name: string;
  type: string;
  /** Milliseconds since epoch; used for TTL cleanup. */
  savedAt: number;
}

/**
 * Declared as a Dexie subclass rather than a cast instance: Dexie populates the
 * `Table` fields from the schema at open time, so the class form is the only one
 * where those fields are real properties.
 */
class ListingMediaDB extends Dexie {
  media!: Table<ListingMediaRecord, string>;
  meta!: Table<{ key: string; savedAt: number }, string>;

  constructor() {
    super("TradibuListingDraftMedia");
    this.version(1).stores({
      media: "id, draftKey, kind, itemId, savedAt",
      // One marker per draft, so a draft that has *any* media is never judged
      // empty by the "nothing to restore" check.
      meta: "key, savedAt",
    });
  }
}

const db = new ListingMediaDB();

/** A draft with no files is not worth an IndexedDB round trip. */
export function buildMediaId(draftKey: string, kind: ListingMediaKind, itemId: string): string {
  return `${draftKey}::${kind}::${itemId}`;
}

/**
 * Rehydrate a stored Blob into a `File`.
 *
 * The name, type and last-modified time are carried across so the upload path
 * and the size/type validation downstream behave exactly as they did for a
 * freshly picked file. A Blob with no type would be rejected by the accept
 * filters, so the type is restored explicitly.
 */
function toFile(record: ListingMediaRecord): File {
  return new File([record.file], record.name, {
    type: record.type,
    lastModified: Date.now(),
  });
}


/**
 * Replace the stored files for one draft with the current set.
 *
 * This is a full replace rather than an upsert so that removing an image in the
 * form also removes it from disk. Without that, a discarded photo would be
 * resurrected on the next reload.
 */
export async function saveDraftMedia(
  draftKey: string,
  files: { kind: ListingMediaKind; itemId: string; file: File }[],
): Promise<void> {
  try {
    await db.transaction("rw", db.media, db.meta, async () => {
      await db.media.where("draftKey").equals(draftKey).delete();
      const now = Date.now();
      if (files.length > 0) {
        await db.media.bulkPut(
          files.map(({ kind, itemId, file }) => ({
            id: buildMediaId(draftKey, kind, itemId),
            draftKey,
            kind,
            itemId,
            file,
            name: file.name,
            type: file.type,
            savedAt: now,
          })),
        );
        await db.meta.put({ key: draftKey, savedAt: now });
      } else {
        await db.meta.delete(draftKey);
      }
    });
    void pruneExpiredMedia();
  } catch (error) {
    // A full or unavailable quota must never block the seller from saving their
    // listing; the text draft is already safely in localStorage.
    console.warn("[listingDraftMedia] Could not save draft files", error);
  }
}

/** True when this draft has files on disk, so recovery knows to look. */
export async function hasDraftMedia(draftKey: string): Promise<boolean> {
  try {
    return (await db.meta.get(draftKey)) !== undefined;
  } catch {
    return false;
  }
}

export interface RestoredMedia {
  images: File[];
  descriptionImages: File[];
  videos: File[];
  doc: File | null;
}

/**
 * Read a draft's files back, grouped by kind and in their original order.
 *
 * Ordering matters: the first image is the primary one, so the stored order is
 * the seller's chosen order and must be restored as-is.
 */
export async function loadDraftMedia(draftKey: string): Promise<RestoredMedia> {
  const empty: RestoredMedia = { images: [], descriptionImages: [], videos: [], doc: null };
  try {
    const records = await db.media.where("draftKey").equals(draftKey).sortBy("savedAt");
    if (records.length === 0) return empty;
    const restored: RestoredMedia = { images: [], descriptionImages: [], videos: [], doc: null };
    for (const record of records) {
      const file = toFile(record);
      if (record.kind === "image") restored.images.push(file);
      else if (record.kind === "descriptionImage") restored.descriptionImages.push(file);
      else if (record.kind === "video") restored.videos.push(file);
      else if (record.kind === "doc") restored.doc = file;
    }
    return restored;
  } catch (error) {
    console.warn("[listingDraftMedia] Could not read draft files", error);
    return empty;
  }
}

/** Drop every stored file for a draft. Called on discard and on successful publish. */
export async function clearDraftMedia(draftKey: string): Promise<void> {
  try {
    await db.transaction("rw", db.media, db.meta, async () => {
      await db.media.where("draftKey").equals(draftKey).delete();
      await db.meta.delete(draftKey);
    });
  } catch {
    // Non-fatal: a stale blob is reclaimed by the TTL sweep.
  }
}

/** Remove files for drafts that were abandoned and never cleaned up. */
export async function pruneExpiredMedia(): Promise<number> {
  try {
    const cutoff = Date.now() - MEDIA_TTL_MS;
    const stale = await db.media.where("savedAt").below(cutoff).toArray();
    if (stale.length === 0) return 0;
    await db.media.bulkDelete(stale.map((record) => record.id));
    const staleDrafts = [...new Set(stale.map((record) => record.draftKey))];
    const staleMeta = await db.meta.bulkGet(staleDrafts);
    await db.meta.bulkDelete(
      staleMeta
        .filter((entry): entry is { key: string; savedAt: number } => entry !== undefined)
        .filter((entry) => entry.savedAt < cutoff)
        .map((entry) => entry.key),
    );
    return stale.length;
  } catch {
    return 0;
  }
}
