import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import { cn } from '@/lib/utils';

export interface PackageTrackerCardProps {
  status: string;
  packageNumber: string;
  destination: string;
  destinationFlag?: React.ReactNode;
  date: string;
  qrCodeValue: string;
  packageImage?: React.ReactNode;
  onTrackClick?: () => void;
  className?: string;
}

export const PackageTrackerCard = ({
  status,
  packageNumber,
  destination,
  destinationFlag,
  date,
  qrCodeValue,
  packageImage,
  onTrackClick,
  className,
}: PackageTrackerCardProps) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 120, damping: 16 },
    },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'w-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-md',
        className
      )}
    >
      {/* Full-bleed image banner */}
      <div className="relative w-full h-28 overflow-hidden bg-muted">
        {packageImage ? (
          <div className="absolute inset-0 w-full h-full [&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:drop-shadow-none">
            {packageImage}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <QrCode className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* "Show full tracking" pill overlaid on the image */}
        <motion.button
          onClick={onTrackClick}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold text-white whitespace-nowrap hover:bg-black/70 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
          Show full tracking
        </motion.button>
      </div>

      {/* Compact info section */}
      <div className="p-3 space-y-2">
        {/* Status + destination */}
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-bold text-foreground capitalize truncate">{status}</p>
          <div className="flex items-center gap-1 shrink-0">
            {destinationFlag}
            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{destination}</span>
          </div>
        </div>

        {/* Tracking number + QR */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground">Tracking #</p>
            <p className="font-mono text-[10px] font-semibold text-foreground truncate">{packageNumber}</p>
            <p className="text-[9px] text-muted-foreground truncate">{date}</p>
          </div>

          <div className="rounded border p-0.5 shrink-0">
            {qrCodeValue ? (
              <QRCodeCanvas
                value={qrCodeValue}
                size={36}
                bgColor="transparent"
                fgColor="hsl(var(--foreground))"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center bg-muted">
                <QrCode className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
