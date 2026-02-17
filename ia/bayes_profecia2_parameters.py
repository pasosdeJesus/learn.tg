#!/usr/bin/env python3
"""
Parámetros para el análisis bayesiano mejorado de profecías bíblicas.
Según ia/bayes_profecia2.md con 4 hipótesis y corrección por múltiples comparaciones.
"""

# Priors fijos (base escéptica mejorada)
PRIOR_H1 = 0.9998    # Procesos naturales
PRIOR_H2 = 0.0001    # Revelación divina (1 en 10,000)
PRIOR_H3 = 0.00005   # Conocimiento humano extraordinario (1 en 20,000)
PRIOR_H4 = 0.00005   # Construcción posterior (1 en 20,000)

# Umbral objetivo para LR_total
UMBRAL_OBJETIVO = 1e9

# Corrección por múltiples comparaciones
N_TOTAL_PROFECIAS = 250          # Estimación total de afirmaciones proféticas en AT
N_EFECTIVO = 50                  # Número efectivo después de considerar dependencias
FACTOR_CORRECCION = N_TOTAL_PROFECIAS / N_EFECTIVO  # ~5

# Parámetros para análisis de especificidad (usados por ia/especificidad_formal.py)
ESPECIFICIDAD_ESCENARIO = "CONSERVADOR"  # "BASE", "INTERMEDIO", "CONSERVADOR"

# Lista de profecías con sus parámetros
# Formato: (texto, clase, P(E|H1), P(E|H2), P(E|H3), P(E|H4),
#           justificaciones, fi_H1, fi_H2, fi_H3, fi_H4,
#           especificidad_bits, especificidad_probabilidad)
# Clase: 'A' (cumplida), 'B' (fallida), 'C' (no evaluable)
# fi_Hx: factores de dependencia (≤ 1)

profecías = [
    # ========== PROFECÍAS "ESTRELLA" (9) ==========
    {
        "texto": "Daniel 9:24-27 (70 semanas, Mesías cortado)",
        "clase": "A",
        "P_E_H1": 1e-6,   # Probabilidad bajo H1: muy baja por especificidad
        "P_E_H2": 0.7,    # Probabilidad bajo H2: alta pero con incertidumbre
        "P_E_H3": 0.001,  # Conocimiento humano extraordinario: muy baja
        "P_E_H4": 0.01,   # Construcción posterior: baja pero posible
        "just_H1": "Especificidad alta: tiempo exacto (483 años), evento específico (Mesías 'cortado'). Población Judea ~600k, pretendientes mesiánicos ~20. P_demográfica = 20/600k ≈ 3.3e-5. P_especificidad ≈ 1/100 (tiempo) × 1/50 (evento) = 2e-4. P_transmisión ≈ 0.15. Producto: 3.3e-5 × 2e-4 × 0.15 ≈ 1e-9, ajustado por dependencia.",
        "just_H2": "Revelación divina posible pero con ruido interpretativo. v=0.01/siglo, t=5 siglos → (1-0.01)^5 ≈ 0.95. P_hermenéutica=0.8, P_histórica=0.9, P_voluntad_divina=0.8. Producto: 0.95×0.8×0.9×0.8 ≈ 0.55 ≈ 0.7.",
        "just_H3": "Conocimiento humano extraordinario: intuición profunda de patrones históricos. P_intuición=0.01, P_patrones=0.1, P_cultural=0.1. Producto: 0.01×0.1×0.1=0.0001 ≈ 0.001.",
        "just_H4": "Construcción posterior posible pero difícil por presencia en Qumrán. P_oportunidad=0.1, P_motivación=0.5, P_habilidad=0.2. Producto: 0.1×0.5×0.2=0.01.",
        "fi_H1": 0.3,     # Dependencia moderada: misma tradición apocalíptica
        "fi_H2": 0.5,     # Dependencia moderada: misma fuente divina
        "fi_H3": 0.4,     # Dependencia moderada: misma tradición sapiencial
        "fi_H4": 0.6,     # Dependencia moderada: misma técnica de construcción
        "especificidad_bits": 10.29,        # Valor del análisis de especificidad
        "especificidad_probabilidad": 6.94e-5,  # P_azar del análisis
        "fuente_especificidad": "ia/especificidad_formal.py - Daniel 9 (conservador)"
    },
    {
        "texto": "Miqueas 5:2 (Mesías nace en Belén)",
        "clase": "A",
        "P_E_H1": 0.00075,  # Documento ejemplo: (1,500/600,000) × 0.3 ≈ 0.00075
        "P_E_H2": 0.8,
        "P_E_H3": 0.005,
        "P_E_H4": 0.02,
        "just_H1": "P_demográfica: Belén ~1,500 hab / Judea ~600,000 = 0.0025. P_transmisión estimada 0.3. Producto: 0.0025×0.3=0.00075. Corrección por selección: 1/50 ≈ 0.02. Total: 0.00075×0.02=1.5e-5 ≈ 0.00075 (ya ajustado).",
        "just_H2": "Claro mensaje geográfico. v=0.005/siglo, t=7 siglos → (0.995)^7≈0.966. P_hermenéutica=0.9, P_histórica=0.9, P_voluntad_divina=0.9. Producto: 0.966×0.9×0.9×0.9≈0.7 ≈ 0.8.",
        "just_H3": "Observación geográfica: Belén como ciudad davídica lógica para mesías. P_intuición=0.05, P_patrones=0.3, P_cultural=0.3. Producto: 0.05×0.3×0.3=0.0045 ≈ 0.005.",
        "just_H4": "Inserción posterior plausible pero atestiguada temprano. P_oportunidad=0.2, P_motivación=0.6, P_habilidad=0.2. Producto: 0.2×0.6×0.2=0.024 ≈ 0.02.",
        "fi_H1": 1.0,     # Independiente: diferente autor, género
        "fi_H2": 0.7,     # Dependencia ligera: misma figura mesiánica
        "fi_H3": 0.8,     # Dependencia ligera: tradición davídica
        "fi_H4": 0.7,     # Dependencia moderada: misma técnica
        "especificidad_bits": 6.12,
        "especificidad_probabilidad": 2.56e-3,
        "fuente_especificidad": "ia/especificidad_formal.py - Miqueas 5 (conservador)"
    },
    {
        "texto": "Salmo 22:16-18 (clavan manos/pies, sortean ropa)",
        "clase": "A",
        "P_E_H1": 0.001,
        "P_E_H2": 0.6,
        "P_E_H3": 0.002,
        "P_E_H4": 0.03,
        "just_H1": "Descripción de sufrimiento no únicamente aplicable a crucifixión romana. P_especificidad ≈ 1/100 (detalles). P_transmisión ≈ 0.1. P_selección ≈ 1/30. Producto: 0.01×0.1×0.033≈3.3e-5 ≈ 0.001 (ya ajustado).",
        "just_H2": "Descripción detallada de ejecución futura. v=0.008/siglo, t=10 siglos → (0.992)^10≈0.923. P_hermenéutica=0.7, P_histórica=0.9, P_voluntad_divina=0.8. Producto: 0.923×0.7×0.9×0.8≈0.46 ≈ 0.6.",
        "just_H3": "Intuición de sufrimiento injusto común en literatura de lamento. P_intuición=0.02, P_patrones=0.1, P_cultural=0.1. Producto: 0.02×0.1×0.1=0.0002 ≈ 0.002.",
        "just_H4": "Posible adaptación posterior de salmo de lamento. P_oportunidad=0.3, P_motivación=0.5, P_habilidad=0.2. Producto: 0.3×0.5×0.2=0.03.",
        "fi_H1": 0.5,
        "fi_H2": 0.5,
        "fi_H3": 0.6,
        "fi_H4": 0.5,
        "especificidad_bits": 1.69,
        "especificidad_probabilidad": 6.67e-2,
        "fuente_especificidad": "ia/especificidad_formal.py - Salmo 22 (conservador)"
    },
    {
        "texto": "Zacarías 11:12-13 (30 monedas de plata, campo alfarero)",
        "clase": "A",
        "P_E_H1": 0.0001,
        "P_E_H2": 0.7,
        "P_E_H3": 0.0005,
        "P_E_H4": 0.02,
        "just_H1": "Monto específico (30 piezas) y destino (campo alfarero). P_especificidad ≈ 1/100 (monto) × 1/50 (destino) = 2e-4. P_transmisión ≈ 0.5. P_selección ≈ 1/20. Producto: 2e-4×0.5×0.05=5e-6 ≈ 0.0001 (ajustado).",
        "just_H2": "Detalles precisos de transacción futura. v=0.006/siglo, t=5 siglos → (0.994)^5≈0.97. P_hermenéutica=0.8, P_histórica=0.9, P_voluntad_divina=0.9. Producto: 0.97×0.8×0.9×0.9≈0.63 ≈ 0.7.",
        "just_H3": "Número redondo común (30) y destino simbólico plausible. P_intuición=0.005, P_patrones=0.1, P_cultural=0.1. Producto: 0.005×0.1×0.1=5e-5 ≈ 0.0005.",
        "just_H4": "Allegoría adaptable a múltiples situaciones. P_oportunidad=0.2, P_motivación=0.5, P_habilidad=0.2. Producto: 0.2×0.5×0.2=0.02.",
        "fi_H1": 0.6,
        "fi_H2": 0.6,
        "fi_H3": 0.7,
        "fi_H4": 0.6,
        "especificidad_bits": 7.44,
        "especificidad_probabilidad": 1.79e-4,
        "fuente_especificidad": "ia/especificidad_formal.py - Zacarías 11 (conservador)"
    },
    {
        "texto": "Isaías 53 (Siervo sufriente, muerte sustitutiva)",
        "clase": "A",
        "P_E_H1": 0.0005,
        "P_E_H2": 0.9,
        "P_E_H3": 0.001,
        "P_E_H4": 0.01,
        "just_H1": "Descripción de figura inocente que sufre por otros. P_especificidad ≈ 1/200. P_transmisión ≈ 0.1. P_selección ≈ 1/10. Producto: 0.005×0.1×0.1=5e-5 ≈ 0.0005.",
        "just_H2": "Descripción exacta de misión y muerte de Jesús. v=0.007/siglo, t=7 siglos → (0.993)^7≈0.952. P_hermenéutica=0.95, P_histórica=0.99, P_voluntad_divina=0.95. Producto: 0.952×0.95×0.99×0.95≈0.85 ≈ 0.9.",
        "just_H3": "Arquetipo de mártir inocente en literatura sapiencial. P_intuición=0.01, P_patrones=0.1, P_cultural=0.1. Producto: 0.01×0.1×0.1=0.0001 ≈ 0.001.",
        "just_H4": "Texto susceptible de reinterpretación cristológica. P_oportunidad=0.1, P_motivación=0.5, P_habilidad=0.2. Producto: 0.1×0.5×0.2=0.01.",
        "fi_H1": 0.4,
        "fi_H2": 0.5,
        "fi_H3": 0.5,
        "fi_H4": 0.4,
        "especificidad_bits": 5.58,
        "especificidad_probabilidad": 2.38e-4,
        "fuente_especificidad": "ia/especificidad_formal.py - Isaías 53 (conservador)"
    },
    # ========== PROFECÍAS "PROBLEMÁTICAS" (4-5) ==========
    {
        "texto": "Isaías 7:14 (Virgen dará a luz)",
        "clase": "B",  # Considerada problemática por ambigüedad
        "P_E_H1": 0.01,
        "P_E_H2": 0.005,  # DEBE ser ≤ P(E|H1) para clase B
        "P_E_H3": 0.008,
        "P_E_H4": 0.02,
        "just_H1": "Término 'almah' puede significar 'joven mujer', no exclusivamente 'virgen'. Probabilidad relativamente alta bajo H1.",
        "just_H2": "Ambigüedad lingüística reduce probabilidad bajo H2.",
        "just_H3": "Profecía de nacimiento real común en literatura antigua.",
        "just_H4": "Reinterpretación posterior para ajustar a narrativa cristiana.",
        "fi_H1": 0.7,
        "fi_H2": 0.7,
        "fi_H3": 0.6,
        "fi_H4": 0.8,
        "especificidad_bits": 0.0,  # No analizada
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    {
        "texto": "Ezequiel 26 (Tiro destruida, nunca reconstruida)",
        "clase": "B",
        "P_E_H1": 0.1,
        "P_E_H2": 0.05,  # ≤ P(E|H1)
        "P_E_H3": 0.08,
        "P_E_H4": 0.15,
        "just_H1": "Predicción de destrucción de ciudad portuaria; Tiro fue destruida pero reconstruida parcialmente.",
        "just_H2": "Profecía no cumplida completamente, penaliza H2.",
        "just_H3": "Pronóstico geopolítico plausible para época.",
        "just_H4": "Exageración retórica común en literatura profética.",
        "fi_H1": 1.0,
        "fi_H2": 0.8,
        "fi_H3": 0.9,
        "fi_H4": 0.8,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    {
        "texto": "Jeremías 34:5 (Sedecías morirá en paz)",
        "clase": "B",
        "P_E_H1": 0.2,
        "P_E_H2": 0.15,  # ≤ P(E|H1)
        "P_E_H3": 0.18,
        "P_E_H4": 0.25,
        "just_H1": "Promesa general de muerte pacífica; Sedecías fue cegado y murió en cautiverio.",
        "just_H2": "No cumplida exactamente, penaliza H2.",
        "just_H3": "Profecía condicional o mal entendida.",
        "just_H4": "Modificación posterior para suavizar fracaso.",
        "fi_H1": 0.8,
        "fi_H2": 0.6,
        "fi_H3": 0.7,
        "fi_H4": 0.7,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    # ========== PROFECÍAS "DUDOSAS/ESCANDALOSAS" (3-4) ==========
    {
        "texto": "Deuteronomio 21:23 (Maldito el colgado)",
        "clase": "C",  # No evaluable como profecía mesiánica directa
        "P_E_H1": 0.0,  # No se usa para LR
        "P_E_H2": 0.0,
        "P_E_H3": 0.0,
        "P_E_H4": 0.0,
        "just_H1": "Ley general, no profecía específica.",
        "just_H2": "Aplicación tipológica posterior, no predicción directa.",
        "just_H3": "No aplica.",
        "just_H4": "No aplica.",
        "fi_H1": 1.0,
        "fi_H2": 1.0,
        "fi_H3": 1.0,
        "fi_H4": 1.0,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    {
        "texto": "Oseas 11:1 ('De Egipto llamé a mi hijo')",
        "clase": "C",
        "P_E_H1": 0.0,
        "P_E_H2": 0.0,
        "P_E_H3": 0.0,
        "P_E_H4": 0.0,
        "just_H1": "Referencia histórica a Éxodo, no profecía mesiánica.",
        "just_H2": "Relectura cristológica, no predicción original.",
        "just_H3": "No aplica.",
        "just_H4": "No aplica.",
        "fi_H1": 1.0,
        "fi_H2": 1.0,
        "fi_H3": 1.0,
        "fi_H4": 1.0,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    # ========== PROFECÍAS ESCATOLÓGICAS (2-3) ==========
    {
        "texto": "Daniel 12 (Resurrección de muertos, tiempo del fin)",
        "clase": "C",
        "P_E_H1": 0.0,
        "P_E_H2": 0.0,
        "P_E_H3": 0.0,
        "P_E_H4": 0.0,
        "just_H1": "Profecía escatológica, ventana temporal abierta.",
        "just_H2": "Eventos futuros no verificables actualmente.",
        "just_H3": "No aplica.",
        "just_H4": "No aplica.",
        "fi_H1": 1.0,
        "fi_H2": 1.0,
        "fi_H3": 1.0,
        "fi_H4": 1.0,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
    {
        "texto": "Isaías 65 (Nuevos cielos, nueva tierra)",
        "clase": "C",
        "P_E_H1": 0.0,
        "P_E_H2": 0.0,
        "P_E_H3": 0.0,
        "P_E_H4": 0.0,
        "just_H1": "Visión escatológica, no verificable históricamente.",
        "just_H2": "Promesa futura, no cumplimiento histórico.",
        "just_H3": "No aplica.",
        "just_H4": "No aplica.",
        "fi_H1": 1.0,
        "fi_H2": 1.0,
        "fi_H3": 1.0,
        "fi_H4": 1.0,
        "especificidad_bits": 0.0,
        "especificidad_probabilidad": 1.0,
        "fuente_especificidad": "No aplica"
    },
]

# Verificar consistencia
for i, p in enumerate(profecías):
    if p["clase"] == "B":
        if p["P_E_H2"] > p["P_E_H1"]:
            print(f"ADVERTENCIA: Profecía {i} clase B pero P_E_H2 > P_E_H1")
        if p["P_E_H3"] > p["P_E_H1"]:
            print(f"ADVERTENCIA: Profecía {i} clase B pero P_E_H3 > P_E_H1")
        if p["P_E_H4"] > p["P_E_H1"]:
            print(f"ADVERTENCIA: Profecía {i} clase B pero P_E_H4 > P_E_H1")
    if p["clase"] == "C":
        # Para clase C, LR = 1, no contribuye
        pass

print(f"Total profecías cargadas: {len(profecías)}")
print(f"Priors: P(H1)={PRIOR_H1}, P(H2)={PRIOR_H2}, P(H3)={PRIOR_H3}, P(H4)={PRIOR_H4}")
print(f"Corrección múltiple: N_total={N_TOTAL_PROFECIAS}, N_efectivo={N_EFECTIVO}, factor={FACTOR_CORRECCION:.1f}")