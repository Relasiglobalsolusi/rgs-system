"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AlertTriangle, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import {
  UnsavedDialogGuardProvider,
  useUnsavedDialogGuard,
} from "@/components/ui/unsaved-dialog-guard"

type DialogRootProps = DialogPrimitive.Root.Props & {
  skipUnsavedGuard?: boolean
}

function Dialog({
  skipUnsavedGuard,
  onOpenChange,
  children,
  ...props
}: DialogRootProps) {
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const callUserOpenChange = React.useCallback<
    NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>
  >((open, eventDetails) => {
    onOpenChangeRef.current?.(open, eventDetails)
  }, [])

  return (
    <UnsavedDialogGuardProvider
      skip={Boolean(skipUnsavedGuard)}
      onRequestClose={(open, eventDetails) => {
        onOpenChangeRef.current?.(open, eventDetails as never)
      }}
    >
      <DialogGuardedRoot
        skipUnsavedGuard={skipUnsavedGuard}
        onOpenChange={callUserOpenChange}
        {...props}
      >
        {children}
      </DialogGuardedRoot>
      {skipUnsavedGuard ? null : <UnsavedDiscardConfirm />}
    </UnsavedDialogGuardProvider>
  )
}

function DialogGuardedRoot({
  skipUnsavedGuard,
  onOpenChange,
  ...props
}: DialogRootProps) {
  const guard = useUnsavedDialogGuard()

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      {...props}
      onOpenChange={(open, eventDetails) => {
        if (open) {
          onOpenChange?.(open, eventDetails)
          return
        }
        if (!guard || skipUnsavedGuard || guard.skip) {
          onOpenChange?.(open, eventDetails)
          return
        }
        const blocked = guard.requestClose(() => {
          onOpenChange?.(false, eventDetails)
        })
        if (blocked) {
          const details = eventDetails as { cancel?: () => void } | undefined
          details?.cancel?.()
        }
      }}
    />
  )
}

function UnsavedDiscardConfirm() {
  const guard = useUnsavedDialogGuard()
  const { t } = useT()
  if (!guard) return null

  return (
    <Dialog
      skipUnsavedGuard
      open={guard.confirmOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) guard.cancelDiscard()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[80]"
        className="z-[80] gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0 sm:max-w-sm"
      >
        <div className="max-h-[min(90dvh,24rem)] overflow-y-auto px-4 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-7">
          <DialogHeader className="items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-tint-amber ring-1 ring-amber-500/25">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div className="space-y-2.5">
              <DialogTitle className="text-lg font-semibold text-text">
                {t("common.confirm.unsavedTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted">
                {t("common.confirm.unsavedDescription")}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>
        <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-4 py-5 sm:flex-col sm:justify-stretch sm:px-10 sm:py-6">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-danger/40 bg-card-tint-red text-sm font-semibold text-danger transition hover:bg-[color-mix(in_srgb,var(--color-card-tint-red),var(--color-danger)_12%)]"
            onClick={guard.confirmDiscard}
          >
            {t("common.confirm.exitWithoutSaving")}
          </button>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-elevated text-sm font-medium text-text transition hover:bg-card-hover"
            onClick={guard.cancelDiscard}
          >
            {t("common.confirm.keepEditing")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogTrigger({
  asChild,
  children,
  ...props
}: DialogPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={children}
        {...props}
      />
    )
  }

  return (
    <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props}>
      {children}
    </DialogPrimitive.Trigger>
  )
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/55 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  overlayClassName?: string
}) {
  const guard = useUnsavedDialogGuard()
  const registerRoot = guard?.registerRoot
  const setRoot = React.useCallback(
    (node: HTMLElement | null) => {
      registerRoot?.(node)
    },
    [registerRoot]
  )

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)] ring-0 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-bottom-2",
          className
        )}
        {...props}
      >
        <div
          ref={setRoot}
          data-unsaved-root=""
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
        >
          {children}
        </div>
        {showCloseButton && (
          <Button
            type="button"
            data-slot="dialog-close"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 z-10 text-text hover:bg-elevated hover:text-text"
            onClick={() => {
              if (guard && !guard.skip) {
                guard.requestClose(() => guard.closeDialog())
                return
              }
              guard?.closeDialog()
            }}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-elevated p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-semibold text-text",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-text",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
