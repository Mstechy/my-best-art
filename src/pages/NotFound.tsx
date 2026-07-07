import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import GradientOrb from "@/components/GradientOrb";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <GradientOrb color="primary" size="xl" className="-top-40 -right-40 opacity-10" />
      <GradientOrb color="accent" size="lg" className="-bottom-20 -left-20 opacity-10" />

      <div className="text-center relative z-10 px-6">
        <p className="font-display text-8xl md:text-9xl font-bold gradient-text mb-4">404</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">Page not found</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button className="gap-2 gradient-primary text-primary-foreground shadow-glow w-full sm:w-auto">
              <Home className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
