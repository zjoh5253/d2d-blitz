"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "default" | "destructive" | "success"

export interface ToastData {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: ToastData[]
  toast: (data: Omit<ToastData, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    ({ duration = 5000, ...data }: Omit<ToastData, "id">) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, duration, ...data }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>")
  return ctx
}

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastData[]
  dismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm"
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

interface ToastProps extends ToastData {
  onDismiss: () => void
}

function Toast({ title, description, variant = "default", onDismiss }: ToastProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
        variant === "default" && "border-input bg-background text-foreground",
        variant === "destructive" &&
          "border-destructive bg-destructive text-destructive-foreground",
        variant === "success" &&
          "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
      )}
    >
      <div className="flex-1 space-y-1">
        {title && <p className="text-sm font-semibold leading-none">{title}</p>}
        {description && (
          <p className="text-sm opacity-90">{description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export { Toast }
