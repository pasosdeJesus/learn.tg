'use client'

import { useState } from 'react'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'

export interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  /** Texto accesible del botón cuando la clave está oculta (acción: mostrarla). */
  showLabel: string
  /** Texto accesible del botón cuando la clave está visible (acción: ocultarla). */
  hideLabel: string
}

/**
 * Campo de clave con el ojo para mostrar lo tecleado.
 *
 * Reporte del operador (2026-09-28): en el diálogo de la billetera in-app se podía
 * teclear la clave pero no verla, y sin verla es fácil equivocarse en una clave que
 * después se pide para desbloquear (y que no se puede recuperar: sólo la frase de 12
 * palabras). El botón no envía el formulario (`type="button"`).
 */
export function PasswordInput({ showLabel, hideLabel, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`pr-10 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        data-testid="password-visibility"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
      >
        <EyeIcon hidden={visible} />
      </button>
    </div>
  )
}

/** Ojo abierto (mostrar) u ojo tachado (ocultar), sin dependencias de iconos. */
function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-testid={hidden ? 'password-visibility-off' : 'password-visibility-on'}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {hidden && <line x1="2" y1="2" x2="22" y2="22" />}
    </svg>
  )
}
