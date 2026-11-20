import { Navigate } from "react-router-dom";

/**
 * Compatibility entry for old bookmarks and deployments.
 *
 * Categories are discovered inside the marketplace listing now. Concrete
 * department routes remain `/categories/:slug`; the old standalone directory
 * must not be rendered again as a second catalogue homepage.
 */
export default function CategoriesPage() {
  return <Navigate to="/marketplace" replace />;
}
