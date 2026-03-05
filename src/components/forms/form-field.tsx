"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  name: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  description?: string
}

export function FormField({
  label,
  name,
  error,
  required,
  children,
  className,
  description,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Clone child to inject id and aria-invalid when error present */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: name,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": error ? `${name}-error` : undefined,
          })
        : children}

      {error && (
        <p id={`${name}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
