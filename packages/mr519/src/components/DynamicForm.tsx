'use client'

import { useState } from 'react'

export interface FormField {
  id: number
  nombre: string
  nombreinterno: string
  tipo: number
  obligatorio: boolean
  ayudauso?: string | null
  ancho?: number | null
  columna?: number | null
  fila?: number | null
  options?: { id: number; nombre: string; valor: string }[]
}

export interface FormDefinition {
  id: number
  nombre: string
  nombreinterno: string
  fields: FormField[]
}

const TIPO = {
  ENTERO: 0,
  FLOTANTE: 1,
  FECHA: 2,
  TEXTO: 3,
  TEXTOLARGO: 4,
  PRESENTATEXTO: 5,
  BOOLEANO: 6,
  SELECCIONSIMPLE: 7,
  SELECCIONMULTIPLE: 8,
  SMTABLABASICA: 9,
  SSTABLABASICA: 10,
} as const

export function DynamicForm({
  definition,
  onSubmit,
  initialValues,
  loading = false,
}: {
  definition: FormDefinition
  onSubmit: (values: Record<string, string | string[]>) => Promise<void>
  initialValues?: Record<string, string | string[]>
  loading?: boolean
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>(initialValues || {})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setValue = (fieldId: number, value: string | string[]) => {
    setValues(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => { const { [fieldId]: _, ...rest } = prev; return rest })
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    for (const f of definition.fields) {
      if (f.obligatorio) {
        const v = values[f.id]
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
          newErrors[f.id] = 'Required'
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    await onSubmit(values)
  }

  const sorted = [...definition.fields].sort((a, b) => (a.fila || 1) - (b.fila || 1) || (a.columna || 1) - (b.columna || 1))

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{definition.nombre}</h2>
      {sorted.map(field => (
        <div key={field.id}>
          <label className="block text-sm font-medium mb-1">
            {field.nombre}
            {field.obligatorio && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.ayudauso && <p className="text-xs text-gray-500 mb-1">{field.ayudauso}</p>}

          {field.tipo === TIPO.PRESENTATEXTO ? (
            <p className="text-sm text-gray-700 py-2">{field.nombre}</p>
          ) : field.tipo === TIPO.BOOLEANO ? (
            <input type="checkbox" checked={values[field.id] === '1'}
              onChange={e => setValue(field.id, e.target.checked ? '1' : '0')}
              className="w-5 h-5" />
          ) : field.tipo === TIPO.TEXTOLARGO ? (
            <textarea value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              rows={3} className="w-full border rounded px-3 py-2 text-sm" />
          ) : field.tipo === TIPO.FECHA ? (
            <input type="date" value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          ) : field.tipo === TIPO.ENTERO ? (
            <input type="number" step="1" value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          ) : field.tipo === TIPO.FLOTANTE ? (
            <input type="number" step="any" value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          ) : field.tipo === TIPO.SELECCIONSIMPLE || field.tipo === TIPO.SSTABLABASICA ? (
            <select value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="">—</option>
              {(field.options || []).map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          ) : field.tipo === TIPO.SELECCIONMULTIPLE || field.tipo === TIPO.SMTABLABASICA ? (
            <div className="space-y-1">
              {(field.options || []).map(o => {
                const selected = (values[field.id] as string[]) || []
                return (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(String(o.id))}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...selected, String(o.id)]
                          : selected.filter(x => x !== String(o.id))
                        setValue(field.id, next)
                      }}
                      className="w-4 h-4" />
                    {o.nombre}
                  </label>
                )
              })}
            </div>
          ) : (
            /* TEXTO (default) */
            <input type="text" value={(values[field.id] as string) || ''} onChange={e => setValue(field.id, e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          )}

          {errors[field.id] && <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>}
        </div>
      ))}

      <button onClick={handleSubmit} disabled={loading}
        className={`px-6 py-2 rounded text-sm font-medium text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {loading ? 'Saving...' : 'Submit'}
      </button>
    </div>
  )
}
