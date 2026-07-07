import { Dialog, DialogContent } from "./ui/dialog";
import { Paperclip, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string;
}

const SUPABASE_HOST = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return ""; }
})();

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!SUPABASE_HOST && u.host === SUPABASE_HOST
      && u.pathname.includes("/storage/v1/object/");
  } catch { return false; }
}

export default function AttachmentLightbox({ open, onOpenChange, url }: Props) {
  const safe = isSafeUrl(url);
  const isImage = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-background/95 p-2">
        {!safe ? (
          <div className="p-8 text-center space-y-3">
            <Paperclip className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">This attachment is not from a trusted source.</p>
            <p className="text-xs text-muted-foreground break-all">{url}</p>
          </div>
        ) : isImage ? (
          <img src={url} alt="Attachment" className="w-full h-auto max-h-[85vh] object-contain rounded" />
        ) : isPdf ? (
          <iframe src={url} title="PDF attachment" className="w-full h-[85vh] rounded border border-border" />
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 m-8 mx-auto rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40">
            <ExternalLink className="h-4 w-4" /> Open attachment
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
