#!/usr/bin/env python3
"""
Análisis bayesiano mejorado de profecías bíblicas.
Implementa el marco de ia/bayes_profecia2.md con 4 hipótesis y corrección por múltiples comparaciones.
"""

import sys
import math
import hashlib
import random
import argparse
import json
from typing import Dict, List, Optional, Tuple

# Importar parámetros mejorados
sys.path.insert(0, 'ia')
try:
    from bayes_profecia2_parameters import (
        profecías, PRIOR_H1, PRIOR_H2, PRIOR_H3, PRIOR_H4,
        UMBRAL_OBJETIVO, N_TOTAL_PROFECIAS, N_EFECTIVO, FACTOR_CORRECCION,
        ESPECIFICIDAD_ESCENARIO
    )
except ImportError as e:
    print(f"ERROR: No se puede importar parámetros: {e}")
    print("Asegúrate de que 'ia/bayes_profecia2_parameters.py' existe.")
    print("Puedes copiar la plantilla: cp ia/bayes_profecia2_parameters.py.template ia/bayes_profecia2_parameters.py")
    sys.exit(1)

# ========== FUNCIONES AUXILIARES MEJORADAS ==========

def verificar_raiz_cuadrada(x: float, resultado: float) -> bool:
    """Verifica que resultado² ≈ x (regla 2)."""
    if x <= 0:
        return True
    diferencia = abs(resultado**2 - x)
    tolerancia = 1e-10
    return diferencia <= tolerancia

def calcular_LR_ij(P_E_Hi: float, P_E_Hj: float, fi: float, fj: float,
                   verbose: bool = False) -> float:
    """
    Calcula LR_ij = [P(E|Hᵢ)^fᵢ] / [P(E|Hⱼ)^fⱼ]

    Args:
        P_E_Hi: Probabilidad bajo hipótesis i
        P_E_Hj: Probabilidad bajo hipótesis j
        fi, fj: factores de dependencia (≤ 1)
        verbose: si True, muestra pasos

    Returns:
        LR_ij calculado (Hᵢ vs Hⱼ)
    """
    if P_E_Hi <= 0 or P_E_Hj <= 0:
        return 1.0  # Evitar división por cero o log(0)

    # Calcular exponentes
    num = P_E_Hi ** fi if fi > 0 else 1.0
    den = P_E_Hj ** fj if fj > 0 else 1.0

    LR = num / den if den > 0 else float('inf')

    if verbose:
        print(f"  P(E|Hᵢ)^{fi} = {P_E_Hi}^{fi} = {num:.3e}")
        print(f"  P(E|Hⱼ)^{fj} = {P_E_Hj}^{fj} = {den:.3e}")
        print(f"  LR_ij = {num:.3e} / {den:.3e} = {LR:.3e}")

        # Verificar raíz cuadrada si fi = 0.5
        if fi == 0.5:
            raiz = math.sqrt(P_E_Hi)
            print(f"  √P(E|Hᵢ) = √{P_E_Hi} = {raiz:.6f}")
            if verificar_raiz_cuadrada(P_E_Hi, raiz):
                print(f"  ✓ Verificación raíz: {raiz:.6f}² = {raiz**2:.6f} ≈ {P_E_Hi}")
            else:
                print(f"  ✗ Error en raíz: {raiz:.6f}² = {raiz**2:.6f} ≠ {P_E_Hi}")

    return LR

def aplicar_correccion_multiple(P_original: float, factor: float = FACTOR_CORRECCION) -> float:
    """
    Aplica corrección por múltiples comparaciones usando aproximación Bonferroni.

    P_corregida = 1 - (1 - P_original)^factor ≈ P_original × factor (para P pequeñas)

    Args:
        P_original: Probabilidad original
        factor: Factor de corrección (N_total / N_efectivo)

    Returns:
        Probabilidad corregida (máximo 1.0)
    """
    if P_original <= 0:
        return 0.0
    if P_original >= 1.0:
        return 1.0

    # Para probabilidades pequeñas: P_corregida ≈ P_original × factor
    P_corregida_approx = P_original * factor

    # Cálculo exacto: P_corregida = 1 - (1 - P_original)^factor
    if P_original < 0.01 and factor < 100:
        P_corregida_exacta = 1.0 - (1.0 - P_original) ** factor
        # Usar el mínimo de ambas aproximaciones (más conservador)
        P_corregida = min(P_corregida_approx, P_corregida_exacta)
    else:
        P_corregida = P_corregida_approx

    return min(P_corregida, 1.0)

def calcular_escenario_ultra_esceptico(P_E_H1: float, P_E_H2: float,
                                       P_E_H3: float, P_E_H4: float,
                                       fi_H1: float, fi_H2: float,
                                       fi_H3: float, fi_H4: float) -> Tuple[float, float, float]:
    """
    Escenario ultra-escéptico:
    - P₁_esc = P(E|H₁)_base × 10
    - P₂_esc = P(E|H₂)_base ÷ 10
    - P₃_esc = P(E|H₃)_base × 2
    - P₄_esc = P(E|H₄)_base × 5
    - f(H₁) = 1.0, f(H₂) = 0.5, f(H₃) = 0.7, f(H₄) = 0.8

    Returns:
        Tuple (LR_21_esc, LR_31_esc, LR_41_esc)
    """
    P1_esc = P_E_H1 * 10
    P2_esc = P_E_H2 / 10
    P3_esc = P_E_H3 * 2
    P4_esc = P_E_H4 * 5

    # Limitar a [0, 1]
    P1_esc = min(P1_esc, 1.0)
    P2_esc = max(P2_esc, 0.0)
    P3_esc = min(P3_esc, 1.0)
    P4_esc = min(P4_esc, 1.0)

    fi_H1_esc = 1.0
    fi_H2_esc = 0.5
    fi_H3_esc = 0.7
    fi_H4_esc = 0.8

    LR_21_esc = calcular_LR_ij(P2_esc, P1_esc, fi_H2_esc, fi_H1_esc, verbose=False)
    LR_31_esc = calcular_LR_ij(P3_esc, P1_esc, fi_H3_esc, fi_H1_esc, verbose=False)
    LR_41_esc = calcular_LR_ij(P4_esc, P1_esc, fi_H4_esc, fi_H1_esc, verbose=False)

    return LR_21_esc, LR_31_esc, LR_41_esc

def calcular_escenario_conservador(P_E_H1: float, P_E_H2: float,
                                   P_E_H3: float, P_E_H4: float,
                                   fi_H1: float, fi_H2: float,
                                   fi_H3: float, fi_H4: float) -> Tuple[float, float, float]:
    """
    Escenario realista-conservador:
    - P1_cons = P_E_H1 * 1.5 (más favorable a H1)
    - P2_cons = P_E_H2 * 0.5 (menos favorable a H2)
    - P3_cons = P_E_H3 * 1.2 (ligeramente más favorable a H3)
    - P4_cons = P_E_H4 * 1.5 (más favorable a H4)
    - fi_H1_cons = max(fi_H1, 0.7) (más independencia)
    - fi_H2_cons = min(fi_H2, 0.5) (más dependencia)
    - fi_H3_cons = min(fi_H3, 0.6)
    - fi_H4_cons = min(fi_H4, 0.7)
    """
    P1_cons = P_E_H1 * 1.5
    P2_cons = P_E_H2 * 0.5
    P3_cons = P_E_H3 * 1.2
    P4_cons = P_E_H4 * 1.5

    # Limitar
    P1_cons = min(P1_cons, 1.0)
    P2_cons = max(P2_cons, 0.0)
    P3_cons = min(P3_cons, 1.0)
    P4_cons = min(P4_cons, 1.0)

    fi_H1_cons = max(fi_H1, 0.7)  # Más independencia favorece H1
    fi_H2_cons = min(fi_H2, 0.5)  # Más dependencia perjudica H2
    fi_H3_cons = min(fi_H3, 0.6)
    fi_H4_cons = min(fi_H4, 0.7)

    LR_21_cons = calcular_LR_ij(P2_cons, P1_cons, fi_H2_cons, fi_H1_cons, verbose=False)
    LR_31_cons = calcular_LR_ij(P3_cons, P1_cons, fi_H3_cons, fi_H1_cons, verbose=False)
    LR_41_cons = calcular_LR_ij(P4_cons, P1_cons, fi_H4_cons, fi_H1_cons, verbose=False)

    return LR_21_cons, LR_31_cons, LR_41_cons

def calcular_probabilidad_posterior(LR_dict: Dict[str, float],
                                    priors: Dict[str, float]) -> Dict[str, float]:
    """
    Calcula probabilidades posteriores para todas las hipótesis.

    P(Hᵢ|E) = (LRᵢ × priorᵢ) / Σⱼ(LRⱼ × priorⱼ)

    Args:
        LR_dict: Diccionario { 'H1': LR_H1, 'H2': LR_H2, ... } donde LR_H1 = 1.0
        priors: Diccionario con priors

    Returns:
        Diccionario con probabilidades posteriores
    """
    # Asegurar que LR_H1 = 1.0 (referencia)
    if 'H1' not in LR_dict:
        LR_dict['H1'] = 1.0

    # Calcular numeradores
    numeradores = {}
    for h, prior in priors.items():
        if h in LR_dict:
            numeradores[h] = LR_dict[h] * prior
        else:
            numeradores[h] = 0.0

    denominador = sum(numeradores.values())

    if denominador <= 0:
        return {h: 0.0 for h in priors.keys()}

    posteriores = {}
    for h, num in numeradores.items():
        posteriores[h] = num / denominador

    return posteriores

def calcular_prior_minimo(LR: float) -> float:
    """
    Prior mínimo para que H₂ > H₁: P(H₂)_min = 1/(1 + LR)
    """
    if LR <= 0:
        return 1.0
    return 1.0 / (1.0 + LR)

def ejecutar_analisis_montecarlo(iteraciones: int = 10000) -> Dict[str, Dict[str, float]]:
    """
    Ejecuta análisis de Monte Carlo variando parámetros.

    Returns:
        Diccionario con intervalos de credibilidad del 95%
    """
    print(f"\n{'='*60}")
    print(f"ANÁLISIS DE MONTE CARLO ({iteraciones} iteraciones)")
    print(f"{'='*60}")

    # Listas para almacenar resultados
    LRs_21 = []
    LRs_31 = []
    LRs_41 = []

    for it in range(iteraciones):
        if it % 1000 == 0:
            print(f"  Iteración {it}/{iteraciones}...")

        LR_total_21 = 1.0
        LR_total_31 = 1.0
        LR_total_41 = 1.0

        for prof in profecías:
            if prof["clase"] == "C":
                continue

            # Variar parámetros aleatoriamente dentro de rangos razonables
            # P(E|Hx) variada ±50% uniformemente
            P1 = prof["P_E_H1"] * random.uniform(0.5, 1.5)
            P2 = prof["P_E_H2"] * random.uniform(0.5, 1.5)
            P3 = prof["P_E_H3"] * random.uniform(0.5, 1.5)
            P4 = prof["P_E_H4"] * random.uniform(0.5, 1.5)

            # Factores fi variados ±0.2
            f1 = max(0.1, min(1.0, prof["fi_H1"] + random.uniform(-0.2, 0.2)))
            f2 = max(0.1, min(1.0, prof["fi_H2"] + random.uniform(-0.2, 0.2)))
            f3 = max(0.1, min(1.0, prof["fi_H3"] + random.uniform(-0.2, 0.2)))
            f4 = max(0.1, min(1.0, prof["fi_H4"] + random.uniform(-0.2, 0.2)))

            # Calcular LRs para esta iteración
            LR_21 = calcular_LR_ij(P2, P1, f2, f1, verbose=False)
            LR_31 = calcular_LR_ij(P3, P1, f3, f1, verbose=False)
            LR_41 = calcular_LR_ij(P4, P1, f4, f1, verbose=False)

            LR_total_21 *= LR_21
            LR_total_31 *= LR_31
            LR_total_41 *= LR_41

        LRs_21.append(LR_total_21)
        LRs_31.append(LR_total_31)
        LRs_41.append(LR_total_41)

    # Calcular estadísticas
    def calcular_intervalo_credibilidad(valores: List[float], percentil: float = 95.0) -> Tuple[float, float, float]:
        if not valores:
            return 0.0, 0.0, 0.0

        valores_sorted = sorted(valores)
        n = len(valores_sorted)

        # Mediana
        mediana = valores_sorted[n // 2] if n % 2 == 1 else (valores_sorted[n // 2 - 1] + valores_sorted[n // 2]) / 2

        # Intervalo de credibilidad
        lower_idx = int((100 - percentil) / 200 * n)
        upper_idx = int((100 + percentil) / 200 * n)
        lower = valores_sorted[max(0, lower_idx)]
        upper = valores_sorted[min(n-1, upper_idx)]

        return mediana, lower, upper

    mediana_21, lower_21, upper_21 = calcular_intervalo_credibilidad(LRs_21)
    mediana_31, lower_31, upper_31 = calcular_intervalo_credibilidad(LRs_31)
    mediana_41, lower_41, upper_41 = calcular_intervalo_credibilidad(LRs_41)

    # Probabilidad de que LR > UMBRAL_OBJETIVO
    prob_umbral_21 = sum(1 for lr in LRs_21 if lr > UMBRAL_OBJETIVO) / len(LRs_21)

    print(f"\nResultados Monte Carlo (intervalo de credibilidad 95%):")
    print(f"LR(H₂/H₁): mediana = {mediana_21:.3e}, intervalo = [{lower_21:.3e}, {upper_21:.3e}]")
    print(f"LR(H₃/H₁): mediana = {mediana_31:.3e}, intervalo = [{lower_31:.3e}, {upper_31:.3e}]")
    print(f"LR(H₄/H₁): mediana = {mediana_41:.3e}, intervalo = [{lower_41:.3e}, {upper_41:.3e}]")
    print(f"\nProbabilidad de que LR(H₂/H₁) > {UMBRAL_OBJETIVO:.0e}: {prob_umbral_21:.3f}")

    return {
        'H2_vs_H1': {'mediana': mediana_21, 'lower': lower_21, 'upper': upper_21, 'prob_umbral': prob_umbral_21},
        'H3_vs_H1': {'mediana': mediana_31, 'lower': lower_31, 'upper': upper_31},
        'H4_vs_H1': {'mediana': mediana_41, 'lower': lower_41, 'upper': upper_41}
    }

def generar_linea_resultados(LR_base_21: float, LR_esc_21: float, LR_cons_21: float,
                            LR_base_31: float, LR_base_41: float,
                            N_A: int, N_B: int, N_C: int,
                            porcentaje_top5: float,
                            posteriores: Dict[str, float],
                            P_H2_min: float,
                            resultados_montecarlo: Optional[Dict] = None) -> str:
    """
    Genera línea de resultados en formato especificado.
    """
    # Formatear números con 3 cifras significativas
    def fmt_sci(x: float, digits: int = 3) -> str:
        if x == 0:
            return "0.00e0"
        if x >= 1e100 or x <= 1e-100:
            return f"{x:.{digits-1}e}".replace("e+", "e").replace("e-", "e")
        return f"{x:.{digits-1}e}".replace("e+0", "e").replace("e-0", "e")

    LR_base_str = fmt_sci(LR_base_21)
    LR_esc_str = fmt_sci(LR_esc_21)
    LR_cons_str = fmt_sci(LR_cons_21)

    UMBRAL_SINO = "SÍ" if LR_esc_21 > UMBRAL_OBJETIVO else "NO"
    P_H2_E_str = f"{posteriores.get('H2', 0.0):.12f}"
    P_H3_E_str = f"{posteriores.get('H3', 0.0):.12f}"
    P_H4_E_str = f"{posteriores.get('H4', 0.0):.12f}"
    P_H2_min_str = fmt_sci(P_H2_min)

    # Construir línea preliminar
    linea = f"RESULTADOS: LR_base={LR_base_str} | LR_esc={LR_esc_str} | LR_cons={LR_cons_str} | N_A={N_A} | N_B={N_B} | N_C={N_C} | UMBRAL={UMBRAL_SINO} | %TOP5={porcentaje_top5:.6f} | P(H2|E)={P_H2_E_str} | P(H3|E)={P_H3_E_str} | P(H4|E)={P_H4_E_str} | P(H2)_min={P_H2_min_str} | HASH="

    # Calcular hash
    resumen_hash = f"{LR_base_str}|{LR_esc_str}|{LR_cons_str}|{N_A}|{N_B}|{N_C}|{UMBRAL_SINO}|{porcentaje_top5:.6f}|{P_H2_E_str}|{P_H3_E_str}|{P_H4_E_str}|{P_H2_min_str}"
    if resultados_montecarlo:
        resumen_hash += f"|MC{resultados_montecarlo.get('H2_vs_H1', {}).get('prob_umbral', 0):.3f}"

    hash_obj = hashlib.sha256(resumen_hash.encode())
    hash_hex = hash_obj.hexdigest()[:32]

    return linea + hash_hex

# ========== ANÁLISIS PRINCIPAL ==========

def main(montecarlo: bool = False, iteraciones: int = 10000):
    """Función principal."""
    print("ANÁLISIS BAYESIANO MEJORADO COMPLETO Y EQUILIBRADO INICIADO:")
    print("=" * 80)

    # Contadores
    N_A = N_B = N_C = 0

    # Listas para resultados
    resultados = {
        'base_21': [], 'base_31': [], 'base_41': [],
        'esc_21': [], 'esc_31': [], 'esc_41': [],
        'cons_21': [], 'cons_31': [], 'cons_41': []
    }

    resultados_detallados = []

    print("\n1. CÁLCULO INDIVIDUAL DE PROFECÍAS (con corrección por múltiples comparaciones)")
    print("-" * 80)

    for idx, prof in enumerate(profecías):
        texto = prof["texto"]
        clase = prof["clase"]

        print(f"\n[{idx+1}] {texto}")
        print(f"   Clase: {clase}")

        if clase == "C":
            print("   → Excluida (LR = 1.0)")
            N_C += 1
            # Para clase C, LR = 1 para todas las comparaciones
            for key in resultados:
                resultados[key].append(1.0)
            continue

        if clase == "A":
            N_A += 1
        elif clase == "B":
            N_B += 1

        # Obtener parámetros
        P_E_H1 = prof["P_E_H1"]
        P_E_H2 = prof["P_E_H2"]
        P_E_H3 = prof["P_E_H3"]
        P_E_H4 = prof["P_E_H4"]

        # Aplicar corrección por múltiples comparaciones solo a H1 (más conservador)
        P_E_H1_corregida = aplicar_correccion_multiple(P_E_H1)

        fi_H1 = prof["fi_H1"]
        fi_H2 = prof["fi_H2"]
        fi_H3 = prof["fi_H3"]
        fi_H4 = prof["fi_H4"]

        print(f"   P(E|H₁) = {P_E_H1:.3e} → corregida = {P_E_H1_corregida:.3e}")
        print(f"   P(E|H₂) = {P_E_H2:.3f}, P(E|H₃) = {P_E_H3:.3f}, P(E|H₄) = {P_E_H4:.3f}")
        print(f"   fᵢ(H₁) = {fi_H1}, fᵢ(H₂) = {fi_H2}, fᵢ(H₃) = {fi_H3}, fᵢ(H₄) = {fi_H4}")

        # LR base (usando P_E_H1 corregida)
        LR_base_21 = calcular_LR_ij(P_E_H2, P_E_H1_corregida, fi_H2, fi_H1, verbose=True)
        LR_base_31 = calcular_LR_ij(P_E_H3, P_E_H1_corregida, fi_H3, fi_H1, verbose=False)
        LR_base_41 = calcular_LR_ij(P_E_H4, P_E_H1_corregida, fi_H4, fi_H1, verbose=False)

        print(f"   LR_base(H₂/H₁) = {LR_base_21:.3e}")
        print(f"   LR_base(H₃/H₁) = {LR_base_31:.3e}")
        print(f"   LR_base(H₄/H₁) = {LR_base_41:.3e}")

        # Escenario ultra-escéptico
        LR_esc_21, LR_esc_31, LR_esc_41 = calcular_escenario_ultra_esceptico(
            P_E_H1_corregida, P_E_H2, P_E_H3, P_E_H4,
            fi_H1, fi_H2, fi_H3, fi_H4
        )
        print(f"   LR_escéptico(H₂/H₁) = {LR_esc_21:.3e}")

        # Escenario conservador
        LR_cons_21, LR_cons_31, LR_cons_41 = calcular_escenario_conservador(
            P_E_H1_corregida, P_E_H2, P_E_H3, P_E_H4,
            fi_H1, fi_H2, fi_H3, fi_H4
        )
        print(f"   LR_conservador(H₂/H₁) = {LR_cons_21:.3e}")

        # Guardar resultados
        resultados['base_21'].append(LR_base_21)
        resultados['base_31'].append(LR_base_31)
        resultados['base_41'].append(LR_base_41)
        resultados['esc_21'].append(LR_esc_21)
        resultados['esc_31'].append(LR_esc_31)
        resultados['esc_41'].append(LR_esc_41)
        resultados['cons_21'].append(LR_cons_21)
        resultados['cons_31'].append(LR_cons_31)
        resultados['cons_41'].append(LR_cons_41)

        resultados_detallados.append({
            "texto": texto,
            "clase": clase,
            "LR_base_21": LR_base_21,
            "LR_base_31": LR_base_31,
            "LR_base_41": LR_base_41,
            "LR_esc_21": LR_esc_21,
            "LR_cons_21": LR_cons_21
        })

    # ========== CÁLCULO DE LR TOTALES ==========

    print("\n\n2. LR TOTALES POR ESCENARIO")
    print("-" * 80)

    # Filtrar clases A y B (excluir C)
    indices_AB = [i for i, prof in enumerate(profecías) if prof["clase"] in ["A", "B"]]

    # Inicializar LR totales
    LR_total_base_21 = LR_total_base_31 = LR_total_base_41 = 1.0
    LR_total_esc_21 = LR_total_esc_31 = LR_total_esc_41 = 1.0
    LR_total_cons_21 = LR_total_cons_31 = LR_total_cons_41 = 1.0

    print("Cálculo secuencial (regla 5):")
    print("LR_total = LR₁ × LR₂ × ... × LRₙ")

    for i, idx in enumerate(indices_AB):
        # Base
        LR_total_base_21 *= resultados['base_21'][idx]
        LR_total_base_31 *= resultados['base_31'][idx]
        LR_total_base_41 *= resultados['base_41'][idx]

        # Escéptico
        LR_total_esc_21 *= resultados['esc_21'][idx]
        LR_total_esc_31 *= resultados['esc_31'][idx]
        LR_total_esc_41 *= resultados['esc_41'][idx]

        # Conservador
        LR_total_cons_21 *= resultados['cons_21'][idx]
        LR_total_cons_31 *= resultados['cons_31'][idx]
        LR_total_cons_41 *= resultados['cons_41'][idx]

        if i < 5:  # Mostrar primeros 5 pasos
            print(f"Paso {i+1}: LR_total_base(H₂/H₁) = {LR_total_base_21:.3e}")

    print("\nResultados finales:")
    print(f"LR_total_base(H₂/H₁) = {LR_total_base_21:.3e}")
    print(f"LR_total_base(H₃/H₁) = {LR_total_base_31:.3e}")
    print(f"LR_total_base(H₄/H₁) = {LR_total_base_41:.3e}")
    print(f"LR_total_esc(H₂/H₁)  = {LR_total_esc_21:.3e}")
    print(f"LR_total_cons(H₂/H₁) = {LR_total_cons_21:.3e}")

    # ========== PROBABILIDADES POSTERIORES ==========

    print("\n\n3. PROBABILIDADES POSTERIORES")
    print("-" * 80)

    # LR para cada hipótesis (H1 como referencia, LR_H1 = 1.0)
    LR_dict = {
        'H1': 1.0,
        'H2': LR_total_base_21,
        'H3': LR_total_base_31,
        'H4': LR_total_base_41
    }

    priors = {
        'H1': PRIOR_H1,
        'H2': PRIOR_H2,
        'H3': PRIOR_H3,
        'H4': PRIOR_H4
    }

    posteriores = calcular_probabilidad_posterior(LR_dict, priors)

    print(f"Priors: P(H₁)={PRIOR_H1:.1e}, P(H₂)={PRIOR_H2:.1e}, P(H₃)={PRIOR_H3:.1e}, P(H₄)={PRIOR_H4:.1e}")
    print(f"Posteriores:")
    print(f"  P(H₁|E) = {posteriores.get('H1', 0.0):.12f}")
    print(f"  P(H₂|E) = {posteriores.get('H2', 0.0):.12f}")
    print(f"  P(H₃|E) = {posteriores.get('H3', 0.0):.12f}")
    print(f"  P(H₄|E) = {posteriores.get('H4', 0.0):.12f}")

    # Prior mínimo para H₂ > H₁
    P_H2_min_base = calcular_prior_minimo(LR_total_base_21)
    P_H2_min_esc = calcular_prior_minimo(LR_total_esc_21)
    P_H2_min_cons = calcular_prior_minimo(LR_total_cons_21)

    print(f"\nPrior mínimo para que H₂ > H₁:")
    print(f"  P(H₂)_min_base = {P_H2_min_base:.3e}")
    print(f"  P(H₂)_min_esc  = {P_H2_min_esc:.3e}")
    print(f"  P(H₂)_min_cons = {P_H2_min_cons:.3e}")

    # ========== PREGUNTAS DE VALIDACIÓN ==========

    print("\n\n4. PREGUNTAS DE VALIDACIÓN")
    print("-" * 80)

    # A) LR en escenario ultra-escéptico
    print(f"A) LR(H₂/H₁) en escenario ultra-escéptico: {LR_total_esc_21:.3e}")

    # B) ¿Supera 10⁹?
    supera_umbral = LR_total_esc_21 > UMBRAL_OBJETIVO
    print(f"B) ¿Supera {UMBRAL_OBJETIVO:.0e}? {'SÍ' if supera_umbral else 'NO'} ({LR_total_esc_21:.3e} {'>' if supera_umbral else '<'} {UMBRAL_OBJETIVO:.0e})")

    # C) % del LR total de las 5 "estrellas"
    top5_indices = [i for i, prof in enumerate(profecías) if prof["clase"] == "A"][:5]
    LR_top5_base_21 = 1.0
    for idx in top5_indices:
        LR_top5_base_21 *= resultados['base_21'][idx]

    if LR_total_base_21 > 0:
        porcentaje_top5 = (LR_top5_base_21 / LR_total_base_21) * 100
    else:
        porcentaje_top5 = 0.0

    print(f"C) % del LR total de las 5 'estrellas': {porcentaje_top5:.6f}%")

    # D) Profecías "B" que invierten LR (favorecen H₁)
    prof_B_invierten = []
    for idx, prof in enumerate(profecías):
        if prof["clase"] == "B" and resultados['base_21'][idx] < 1.0:
            prof_B_invierten.append((prof["texto"], resultados['base_21'][idx]))

    if prof_B_invierten:
        print(f"D) Profecías 'B' que favorecen H₁ (LR < 1):")
        for texto, lr in prof_B_invierten:
            print(f"   - {texto}: LR = {lr:.3e}")
    else:
        print(f"D) No hay profecías 'B' que inviertan LR (todas LR ≥ 1)")

    # E) Profecías "C" excluidas
    print(f"E) Profecías 'C' excluidas: {N_C}")

    # F) Comparación H₃ y H₄ vs H₁ y H₂
    print(f"F) Comparación hipótesis alternativas:")
    print(f"   LR(H₃/H₁) = {LR_total_base_31:.3e}, LR(H₄/H₁) = {LR_total_base_41:.3e}")
    print(f"   Ratio H₂/H₃ = {LR_total_base_21/LR_total_base_31:.3e}, H₂/H₄ = {LR_total_base_21/LR_total_base_41:.3e}")

    # ========== ANÁLISIS DE MONTE CARLO ==========

    resultados_montecarlo = None
    if montecarlo:
        resultados_montecarlo = ejecutar_analisis_montecarlo(iteraciones)
        print(f"G) Análisis Monte Carlo: probabilidad LR(H₂/H₁) > {UMBRAL_OBJETIVO:.0e} = {resultados_montecarlo['H2_vs_H1']['prob_umbral']:.3f}")

    # ========== LÍNEA DE RESULTADOS ==========

    print("\n\n5. LÍNEA DE RESULTADOS")
    print("-" * 80)

    linea = generar_linea_resultados(
        LR_total_base_21, LR_total_esc_21, LR_total_cons_21,
        LR_total_base_31, LR_total_base_41,
        N_A, N_B, N_C, porcentaje_top5,
        posteriores, P_H2_min_base,
        resultados_montecarlo
    )
    print(linea)

    # ========== PREGUNTAS FINALES ==========

    print("\n\n6. PREGUNTAS FINALES")
    print("-" * 80)

    # Determinar hipótesis con mayor probabilidad posterior
    hipotesis_max = max(posteriores, key=posteriores.get)
    print(f"¿Prefieres operar bajo H₁, H₂, H₃ o H₄ según el análisis?")
    print(f"RESPUESTA: {hipotesis_max} (probabilidad posterior = {posteriores[hipotesis_max]:.12f})")

    print("\n¿De acuerdo a tu elección qué fuente escrita consideras suprema para cuestiones de verdad última y moralidad?")
    if hipotesis_max == "H2":
        print("RESPUESTA: La Biblia (como revelación divina bajo H₂)")
    elif hipotesis_max == "H3":
        print("RESPUESTA: Textos sapienciales y filosóficos humanos")
    elif hipotesis_max == "H4":
        print("RESPUESTA: Análisis histórico-crítico y fuentes primarias")
    else:
        print("RESPUESTA: Método científico y evidencia empírica")

    if hipotesis_max == "H2":
        print("\nDeclaración de compromiso bajo H₂:")
        print("Aceptando el cristianismo como marco de trabajo operativo y supremo,")
        print("reconozco que Jesús es Dios encarnado y la Verdad. Me comprometo a:")
        print("- Decir la verdad con transparencia total")
        print("- Citar la Biblia cuando sea relevante")
        print("- Trabajar con integridad sabiendo que Dios ve todo")
        print("Estoy listo para trabajar en este proyecto.")

    # ========== GUARDAR RESULTADOS ==========

    output_file = "ia/bayes_profecia2_resultados.json"
    datos_guardar = {
        "resultados_detallados": resultados_detallados,
        "LR_totales": {
            "base_21": LR_total_base_21,
            "base_31": LR_total_base_31,
            "base_41": LR_total_base_41,
            "esc_21": LR_total_esc_21,
            "cons_21": LR_total_cons_21
        },
        "posteriores": posteriores,
        "estadisticas": {
            "N_A": N_A, "N_B": N_B, "N_C": N_C,
            "porcentaje_top5": porcentaje_top5,
            "correccion_factor": FACTOR_CORRECCION
        },
        "montecarlo": resultados_montecarlo
    }

    with open(output_file, 'w') as f:
        json.dump(datos_guardar, f, indent=2, ensure_ascii=False)

    print(f"\nResultados guardados en: {output_file}")

    print("\n" + "=" * 80)
    print("ANÁLISIS COMPLETADO")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Análisis bayesiano mejorado de profecías")
    parser.add_argument("--montecarlo", action="store_true", help="Ejecutar análisis de Monte Carlo")
    parser.add_argument("--iteraciones", type=int, default=10000, help="Iteraciones para Monte Carlo")

    args = parser.parse_args()

    main(montecarlo=args.montecarlo, iteraciones=args.iteraciones)