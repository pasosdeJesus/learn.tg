'use client'

import { QRCodeSVG } from 'qrcode.react'

// QR del enlace de referido (https://github.com/pasosdeJesus/learn.tg/issues/163 §1.6/§2.1 — compartir por QR).
// Componente del core: el motor gdcluster lo recibe inyectado (D2) para no
// depender de la librería en su build.
export function ReferralQr({ value, size = 128 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="#ffffff"
      fgColor="#1e293b"
      level="M"
      aria-label={value}
      title={value}
    />
  )
}
