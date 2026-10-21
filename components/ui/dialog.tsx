"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger> & {
  asChild?: boolean
}) {
  if (asChild) {
    return (
      <DialogPrimitive.Trigger
        data-slot="dialog-trigger"
        render={children as React.ReactElement}
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

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & {
  asChild?: boolean
}) {
  if (asChild) {
    return (
      <DialogPrimitive.Close
        data-slot="dialog-close"
        render={children as React.ReactElement}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Close data-slot="dialog-close" {...props}>
      {children}
    </DialogPrimitive.Close>
  )
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[open]:animate-in data-[open]:fade-in-0",
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
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // Phones: a bottom sheet with a grabber that slides up from the
          // home indicator. sm+: the classic centred dialog.
          "fixed z-50 grid w-full gap-4 bg-surface outline-none data-[ending-style]:animate-out data-[open]:animate-in",
          "inset-x-0 bottom-0 max-h-[92svh] overflow-y-auto rounded-t-[1.75rem] px-5 pt-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgb(0_0_0/0.18)] duration-300 ease-out data-[ending-style]:slide-out-to-bottom data-[open]:slide-in-from-bottom",
          "sm:inset-x-auto sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-h-[85vh] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border sm:p-6 sm:shadow-lg sm:duration-200 sm:data-[ending-style]:fade-out-0 sm:data-[ending-style]:zoom-out-95 sm:data-[ending-style]:slide-out-to-bottom-0 sm:data-[open]:fade-in-0 sm:data-[open]:zoom-in-95 sm:data-[open]:slide-in-from-bottom-0",
          className
        )}
        {...props}
      >
        <span
          aria-hidden
          className="bg-border absolute top-2.5 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full sm:hidden"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 hidden rounded-xs opacity-70 sm:block ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[open]:bg-accent data-[open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
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
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>[data-slot=button]]:h-11 sm:[&>[data-slot=button]]:h-9",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline">Close</Button>} />
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
