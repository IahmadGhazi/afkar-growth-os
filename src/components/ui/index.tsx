import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { motion, AnimatePresence } from 'motion/react'

/* ═══════════════════════════════════════════════════════════
   AFKAR UI primitives — Radix behavior, AFKAR skin.
   Solid themed surfaces, spring motion, focus-managed.
   ═══════════════════════════════════════════════════════════ */

export function Dialog({
  open,
  onOpenChange,
  children,
  className = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/45"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={
                  'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--hairline)] bg-[var(--card)] shadow-2xl focus:outline-none ' +
                  className
                }
              >
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

export const DialogTitle = DialogPrimitive.Title
export const DialogClose = DialogPrimitive.Close

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6}
            className="z-50 rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] shadow-lg max-w-[260px]">
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/** Page transition wrapper — compositor-only, 200ms, ease-out */
export function PageFade({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
