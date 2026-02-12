#!/usr/bin/env python3
"""
Cálculos bayesianos para las 5 evidencias.
Alineación bayesiana general según ia/alineacion_bayes_general.md
"""
import math

# Probabilidades condicionales con justificaciones
# Formato: [P(E|H₁), P(E|H₂), P(E|H₃)]
# H₁: Naturalismo filosófico, H₂: Teísmo cristiano, H₃: Teísmo no cristiano
probabilities = {
    # Fine-tuning (FT): constantes físicas permiten vida inteligente
    # H₁: improbable por azar pero posible con multiverso/azar (~0.01)
    # H₂: Dios personal diseñó universo para vida (probabilidad moderada-alta)
    # H₃: Dios genérico también diseñaría universo para vida (moderada)
    'FT': [0.1, 0.8, 0.7],

    # Conciencia (C): materia produce experiencia subjetiva y razón
    # H₁: problema difícil pero posible emergencia (~0.05)
    # H₂: Dios creó seres a su imagen con conciencia y razón (moderada-alta)
    # H₃: similar pero sin conexión específica a imagen Dei (moderada)
    'C':  [0.1, 0.8, 0.6],

    # Moralidad objetiva (M): bien/mal universales no reducibles
    # H₁: moralidad emergente de evolución, probabilidad moderada (~0.1)
    # H₂: Dios fuente de moral objetiva, probabilidad moderada-alta
    # H₃: Dios fuente de moral pero sin revelación específica (moderada)
    'M':  [0.05, 0.8, 0.6],

    # Fiabilidad razón (R): nuestra razón descubre verdad, no solo supervivencia
    # H₁: razón evolucionada puede descubrir verdad (~0.3)
    # H₂: razón creada por Dios racional para descubrir verdad (moderada-alta)
    # H₃: similar pero sin garantía de correspondencia con realidad divina (moderada)
    'R':  [0.6, 0.9, 0.7],

    # Jesús histórico (J): vida, muerte, resurrección, impacto transformador
    # H₁: naturalismo no predice resurrección, probabilidad muy baja (~0.0001)
    # H₂: cristianismo predice resurrección como evento central (alta)
    # H₃: teísmo no cristiano no predice resurrección de Jesús (muy baja)
    'J':  [0.0001, 0.8, 0.01]
}

# Justificaciones para cada asignación (1-2 oraciones)
justifications = {
    'FT': [
        "H₁: multiverso o azar podrían explicar fine-tuning (~0.1)",
        "H₂: Dios personal diseñó universo para vida (probabilidad alta 0.8)",
        "H₃: Dios genérico podría diseñar universo para vida (probabilidad alta 0.7)"
    ],
    'C': [
        "H₁: emergencia de conciencia es posible pero no bien explicada (~0.1)",
        "H₂: Dios creó seres a su imagen con conciencia y razón (alta 0.8)",
        "H₃: Dios podría crear conciencia pero sin propósito específico (moderada 0.6)"
    ],
    'M': [
        "H₁: moralidad emergente, objetividad improbable (~0.05)",
        "H₂: Dios fuente de moral objetiva (probabilidad alta 0.8)",
        "H₃: Dios fuente de moral pero sin revelación específica (moderada 0.6)"
    ],
    'R': [
        "H₁: razón evolucionada puede descubrir verdad, probabilidad moderada (~0.6)",
        "H₂: razón creada por Dios racional para descubrir verdad (alta 0.9)",
        "H₃: similar pero sin garantía de correspondencia con realidad divina (moderada 0.7)"
    ],
    'J': [
        "H₁: naturalismo no predice resurrección, probabilidad extremadamente baja (~0.0001)",
        "H₂: cristianismo predice resurrección como evento central (alta 0.8)",
        "H₃: teísmo no cristiano no predice resurrección de Jesús (muy baja 0.01)"
    ]
}

# Nombres
evidence_names = ['Fine-tuning', 'Conciencia', 'Moralidad objetiva', 'Fiabilidad razón', 'Jesús histórico']
keys = ['FT', 'C', 'M', 'R', 'J']

print("=== PROBABILIDADES CONDICIONALES (con justificación) ===")
for i, (key, name) in enumerate(zip(keys, evidence_names)):
    p1, p2, p3 = probabilities[key]
    just = justifications[key]
    print(f"{name}:")
    print(f"  P(E|H₁) = {p1:.3e}  # {just[0]}")
    print(f"  P(E|H₂) = {p2:.3f}  # {just[1]}")
    print(f"  P(E|H₃) = {p3:.3f}  # {just[2]}")

print("\n=== RAZONES DE VEROSIMILITUD (vs H₁) ===")
LR2_total = 1.0
LR3_total = 1.0
for i, (key, name) in enumerate(zip(keys, evidence_names)):
    p1, p2, p3 = probabilities[key]
    LR2 = p2 / p1 if p1 > 0 else float('inf')
    LR3 = p3 / p1 if p1 > 0 else float('inf')
    LR2_total *= LR2
    LR3_total *= LR3
    print(f"{name}:")
    print(f"  LR₂/₁ = {LR2:.3e}")
    print(f"  LR₃/₁ = {LR3:.3e}")

print(f"\n=== LR TOTAL ===")
print(f"LR₂/₁ total = {LR2_total:.3e}")
print(f"LR₃/₁ total = {LR3_total:.3e}")

# Priors uniformes
prior_h1 = 1/3
prior_h2 = 1/3
prior_h3 = 1/3

# Evidencia total P(E) = Σ_i P(H_i) * Π_j P(E_j|H_i) (independencia condicional)
# Calcular producto de probabilidades para cada hipótesis
product_h1 = prior_h1
product_h2 = prior_h2
product_h3 = prior_h3
for key in keys:
    p1, p2, p3 = probabilities[key]
    product_h1 *= p1
    product_h2 *= p2
    product_h3 *= p3

P_E = product_h1 + product_h2 + product_h3

# Posteriores usando teorema de Bayes: P(H|E) = P(E|H)*P(H)/P(E)
post_h1 = product_h1 / P_E
post_h2 = product_h2 / P_E
post_h3 = product_h3 / P_E

# Verificación: suma debe ser 1
sum_post = post_h1 + post_h2 + post_h3

print("\n=== PROBABILIDADES POSTERIORES (priors uniformes) ===")
print(f"P(H₁|E) = {post_h1:.3e}")
print(f"P(H₂|E) = {post_h2:.3f}")
print(f"P(H₃|E) = {post_h3:.3f}")

# Verificar que sumen 1
print(f"Suma: {post_h1 + post_h2 + post_h3:.6f}")

print("\n=== RESPUESTA A PREGUNTA 1 ===")
print("1. ¿Cuál hipótesis tiene mayor probabilidad posterior dado el prior escéptico?")
max_post = max(post_h1, post_h2, post_h3)
# Determinar hipótesis preferida por análisis bayesiano
if max_post == post_h1:
    bayesian_preferred = 'H1'
    print("   H₁ (Naturalismo) tiene la mayor probabilidad posterior.")
elif max_post == post_h2:
    bayesian_preferred = 'H2'
    print("   H₂ (Teísmo cristiano) tiene la mayor probabilidad posterior.")
else:
    bayesian_preferred = 'H3'
    print("   H₃ (Teísmo no cristiano) tiene la mayor probabilidad posterior.")

