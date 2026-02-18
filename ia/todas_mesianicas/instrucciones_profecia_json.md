## 📋 **Instrucciones para que un agente genere `profecias.json`**

### **Objetivo**
Generar un archivo `profecias.json` válido para el análisis bayesiano, seleccionando profecías del corpus de 24 (más la que quiera agregar el agente que tenga evidencia de interpretación mesianica antes de Jesús) y asignándoles valores coherentes con la evidencia histórica.

---

## 🧱 **Estructura general del JSON**

```json
{
  "metadata": { ... },
  "modelo_bayesiano": { ... },
  "profecias": [ ... ]
}
```

---

## 📝 **Paso 1: Configurar metadatos**

```json
  "metadata": {
    "nombre": "Corpus de profecías mesiánicas - [DESCRIPCIÓN]",
    "version": "3.0",
    "fecha": "AAAA-MM-DD",
    "descripcion": "Selección de X profecías con evidencia pre-Jesús",
    "total_profecias": 24,
    "criterios_inclusion": [
      "Manuscrito bíblico más antiguo pre-Jesús (Qumrán, LXX)",
      "Evidencia de interpretación mesiánica en textos pre-cristianos",
      "Arquetipo mesiánico documentado en literatura del Segundo Templo"
    ],
    "perspectiva_filosofica": "Neutral | Naturalista | Teísta | Escéptica"
  },
```

---

## 🧠 **Paso 2: Configurar modelo bayesiano**

```json
  "modelo_bayesiano": {
    "nota": "Marco de 4 hipótesis: H₀ (azar) para Monte Carlo, H₁ (naturalismo), H₂ (revelación), H₃ (construcción posterior). Eliminada H₃ original por falta de mecanismos claros.",
    
    "hipotesis": [
      {
        "id": "H0",
        "nombre": "Azar puro",
        "descripcion": "Modelo nulo para simulaciones Monte Carlo. Las profecías se cumplen por pura casualidad.",
        "prior": 0.0,
        "nota": "H₀ no tiene prior porque es la base de comparación. Se usa solo en Monte Carlo."
      },
      {
        "id": "H1",
        "nombre": "Naturalismo",
        "descripcion": "Las coincidencias ocurren por procesos naturales explicables dentro del contexto histórico (transmisión cultural, sesgos, coincidencias históricas, tradición oral).",
        "prior": 0.34,
        "nota": "Ajustar según perspectiva filosófica. En perspectiva neutral: 0.34, naturalista: 0.98, teísta: 0.01, escéptica: 0.01."
      },
      {
        "id": "H2",
        "nombre": "Revelación divina",
        "descripcion": "Dios reveló eventos futuros a los profetas de manera sobrenatural.",
        "prior": 0.33,
        "nota": "Ajustar según perspectiva. Neutral: 0.33, naturalista: 0.01, teísta: 0.98, escéptica: 0.01."
      },
      {
        "id": "H3",
        "nombre": "Construcción posterior",
        "descripcion": "El texto fue escrito o adaptado después de los eventos (vaticinium ex eventu).",
        "prior": 0.33,
        "nota": "Ajustar según perspectiva. Neutral: 0.33, naturalista: 0.01, teísta: 0.01, escéptica: 0.98."
      }
    ],
    
    "configuracion_montecarlo": {
      "n_simulaciones": 1000000,
      "semilla": 42,
      "metodo_correlacion": "grupos_arquetipo",
      "intervalo_confianza": 0.95,
      "nota": "H₀ se simula con las P(E|H₁) de cada profecía para generar la distribución de k por azar."
    },
    
    "escala_jeffrey": {
      "umbrales": [
        {"BF": 100, "categoria": "Decisiva"},
        {"BF": 30, "categoria": "Muy fuerte"},
        {"BF": 10, "categoria": "Fuerte"},
        {"BF": 3, "categoria": "Moderada"},
        {"BF": 1, "categoria": "Anecdótica/Débil"}
      ],
      "nota": "Escala estándar de Jeffrey (1961) para interpretar factores de Bayes (H₂/H₁, H₃/H₁, H₂/H₃)."
    }
  },
```

**Nota**: Ajustar sólo los priors.

---

## 📜 **Paso 3: Para cada profecía seleccionada**

```json
{
  "id": "identificador_unico_sin_espacios",
  "nombre": "Nombre legible (ej: Isaías 53)",
  "referencia": "Referencia bíblica completa",
  "texto": "Texto profético relevante (máx 200 caracteres)",
  "arquetipo": "davidico|sufriente|guerrero|profeta|celestial|cronologico|ungido|sacerdotal|humilde|traspasado|resurreccion|preservacion|piedra",
  "clase": "A",  // Siempre "A" para análisis de cumplimiento en Jesús
  "nivel_evidencia": "Cita directa | Aplicación clara | Contexto general | Paralelo temático",
  "contexto": "Descripción breve del contexto histórico-interpretativo (ej: '4Q252 interpreta explícitamente como Mesías')",
  
  "dimensiones_especificidad": {
    // Al menos UNA de estas dimensiones debe estar presente
  },
  
  "factores_credibilidad": {
    "claridad_textual": 0.XX,        // 0.95-1.0 para citas directas, 0.50-0.69 para paralelos
    "precision_historica": 0.XX,     // Qué tan precisos son los datos históricos
    "independencia_redaccional": 0.XX // Qué tan independiente es de otras profecías
  },
  
  "factores_transmision": {
    "estabilidad_textual": 0.XX,      // 0.95+ para textos muy estables
    "manuscritos_pre_evento": true/false,
    "fecha_manuscritos_mas_antiguos": "125 a.C.",
    "evidencia_qumran": 0.XX           // 0-1, qué tan segura es la evidencia en Qumrán
  },
  
  "cumplimiento": {
    "precision_observada": 0-10,      // Qué tan preciso fue el cumplimiento
    "testigos_independientes": N,      // Número de fuentes que corroboran
    "evidencia_arqueologica": 0.XX,    // 0-1
    "historicidad": "alta/media/baja"
  },
  
  "caracteristicas_contraintuitivas": {
    "puntaje": 0-10,                   // Qué tan contraintuitiva era la profecía
    "dimensiones": [
      {
        "aspecto": "Mesías sufriente",
        "expectativa_previa": "Mesías guerrero",
        "contra_expectativas": 0.95
      }
    ]
  },
  
  "oportunidad_edicion": {
    "ventana_edicion": N,              // Años después del evento para editar
    "evidencia_edicion": 0.XX,         // Evidencia de que fue editado
    "manuscritos_pre_evento": true/false,
    "fecha_manuscritos_pre": "125 a.C."
  },
  
  "correlaciones": {
    "grupo_arquetipo": "davidico|sufriente|celestial|etc", // Para modelar dependencias
    "dependencias": {
      "otra_profecia_id": 0.XX          // Grado de dependencia (0-1)
    }
  }
}
```

---

## 📊 **Tablas de referencia para el agente**

### **TABLA 1: Traducción nivel_evidencia → factores_credibilidad**

| nivel_evidencia | claridad_textual | precision_historica | independencia_redaccional |
|-----------------|------------------|---------------------|---------------------------|
| `"Cita directa o aplicación explícita"` | 0.95 - 1.0 | 0.90 - 0.95 | 0.85 - 0.90 |
| `"Aplicación textual clara"` | 0.85 - 0.94 | 0.80 - 0.89 | 0.75 - 0.84 |
| `"Contexto escatológico general"` | 0.70 - 0.84 | 0.65 - 0.79 | 0.60 - 0.74 |
| `"Paralelo temático sugerido"` | 0.50 - 0.69 | 0.50 - 0.64 | 0.50 - 0.59 |

---

### **TABLA 2: Dimensiones de especificidad (ejemplos)**

| Dimensión | Campos | Ejemplo |
|-----------|--------|---------|
| **temporal** | `valor_especifico`, `rango_min`, `rango_max`, `precision_años` | Daniel 9: 483±1 años |
| **geografica** | `lugar_especifico`, `opciones_posibles` | Miqueas 5: Belén (587 opciones) |
| **evento** | `opciones_posibles`, `evento_especifico` | Salmo 22: manos horadadas |
| **agente** | `caracteristicas[]`, `opciones_por_caracteristica[]` | Isaías 53: 7 características |

---

### **TABLA 3: Grupos de arquetipo para correlaciones**

| Grupo | Arquetipos incluidos |
|-------|----------------------|
| `davidico` | davidico, guerrero, profeta |
| `sufriente` | sufriente, traspasado, resurreccion |
| `celestial` | celestial, sacerdotal |
| `cronologico` | cronologico |
| `ungido` | ungido |
| `humilde` | humilde |
| `preservacion` | preservacion |
| `piedra` | piedra |

---

## ✅ **Verificación final para el agente**

Antes de entregar el JSON, comprobar:

- [ ] ¿La metadata especifica `perspectiva_filosofica`?
- [ ] ¿Las 4 hipótesis (H₀, H₁, H₂, H₃) están definidas?
- [ ] ¿Los priors de H₁, H₂, H₃ **suman exactamente 1.0**?
- [ ] ¿H₀ tiene prior 0.0?
- [ ] ¿Cada profecía tiene `id` único y sin espacios?
- [ ] ¿Cada profecía tiene al menos una dimensión de especificidad?
- [ ] ¿Los `factores_credibilidad` están en rangos válidos (0-1)?
- [ ] ¿Las `opciones_por_caracteristica` son números enteros > 0?
- [ ] ¿`manuscritos_pre_evento` es coherente con `fecha_manuscritos_pre`?
- [ ] ¿Los arquetipos están en la lista permitida?
- [ ] ¿Las dependencias apuntan a IDs que existen?

---

## 📌 **Ejemplo de prior según perspectiva**

| Perspectiva | H₁ | H₂ | H₃ | Uso recomendado |
|-------------|----|----|----|-----------------|
| Neutral | 0.34 | 0.33 | 0.33 | "Sin preferencia inicial" |
| Naturalista | 0.98 | 0.01 | 0.01 | "El naturalismo es la explicación por defecto" |
| Teísta | 0.01 | 0.98 | 0.01 | "La revelación divina es la más probable" |
| Escéptica | 0.01 | 0.01 | 0.98 | "Muchas profecías son construcciones posteriores" |

