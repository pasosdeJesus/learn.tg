#!/usr/bin/env python3
"""
Análisis bayesiano de profecías mesiánicas con Monte Carlo y Jeffrey.
VERSIÓN CON 3 HIPÓTESIS (H₁, H₂, H₃) + H₀ para Monte Carlo.
H₃ = Construcción posterior (anteriormente H₄).
Eliminado H₃ original por falta de mecanismos claros.
"""

import json
import math
import random
import argparse
import sys
import os
from typing import Dict, List, Any, Tuple, Optional
from collections import Counter


# ========== CONFIGURACIÓN ==========

class Config:
    """Configuración global."""
    N_SIMULACIONES = 1_000_000
    SEMILLA = 42
    BINS_ASCII = 40


# ========== MÓDULO DE ESPECIFICIDAD ==========

class CalculadorEspecificidad:
    """Calcula especificidad desde dimensiones del JSON."""
    
    def __init__(self):
        self.dimensiones_activas = []

    def calcular_bits_temporal(self, dim: Dict[str, Any]) -> float:
        """Calcula bits para dimensión temporal."""
        if dim.get('es_infinito', False):
            return math.log2(5000)

        valor = dim.get('valor_especifico')
        rango_min = dim.get('rango_posible_min')
        rango_max = dim.get('rango_posible_max')
        precision = dim.get('precision_años')

        if None in (valor, rango_min, rango_max, precision):
            return 0.0
        if precision <= 0 or rango_max <= rango_min:
            return 0.0

        N = (rango_max - rango_min) / precision
        return math.log2(N) if N > 0 else 0.0

    def calcular_bits_geografica(self, dim: Dict[str, Any]) -> float:
        opciones = dim.get('opciones_posibles')
        if not opciones or opciones <= 0:
            return 0.0
        return math.log2(opciones)

    def calcular_bits_cuantitativa(self, dim: Dict[str, Any]) -> float:
        valor = dim.get('valor_especifico')
        rango_min = dim.get('rango_min')
        rango_max = dim.get('rango_max')

        if None in (valor, rango_min, rango_max):
            return 0.0
        if rango_max <= rango_min:
            return 0.0

        rango = rango_max - rango_min + 1
        return math.log2(rango) if rango > 0 else 0.0

    def calcular_bits_evento(self, dim: Dict[str, Any]) -> float:
        opciones = dim.get('opciones_posibles')
        if not opciones or opciones <= 0:
            return 0.0
        return math.log2(opciones)

    def calcular_bits_agente(self, dim: Dict[str, Any]) -> float:
        opciones_lista = dim.get('opciones_por_caracteristica', [])
        if not opciones_lista:
            return 0.0

        producto = 1
        for n in opciones_lista:
            if n <= 0:
                return 0.0
            producto *= n

        return math.log2(producto) if producto > 0 else 0.0

    def calcular_bits_totales(self, dimensiones: Dict[str, Any]) -> Tuple[float, List[str], Dict[str, float]]:
        bits_totales = 0.0
        self.dimensiones_activas = []
        bits_por_dimension = {}

        if 'temporal' in dimensiones:
            b = self.calcular_bits_temporal(dimensiones['temporal'])
            if b > 0:
                bits_totales += b
                self.dimensiones_activas.append('temporal')
                bits_por_dimension['temporal'] = round(b, 2)

        if 'geografica' in dimensiones:
            b = self.calcular_bits_geografica(dimensiones['geografica'])
            if b > 0:
                bits_totales += b
                self.dimensiones_activas.append('geográfica')
                bits_por_dimension['geográfica'] = round(b, 2)

        if 'cuantitativa' in dimensiones:
            b = self.calcular_bits_cuantitativa(dimensiones['cuantitativa'])
            if b > 0:
                bits_totales += b
                self.dimensiones_activas.append('cuantitativa')
                bits_por_dimension['cuantitativa'] = round(b, 2)

        if 'evento' in dimensiones:
            b = self.calcular_bits_evento(dimensiones['evento'])
            if b > 0:
                bits_totales += b
                self.dimensiones_activas.append('evento')
                bits_por_dimension['evento'] = round(b, 2)

        if 'agente' in dimensiones:
            b = self.calcular_bits_agente(dimensiones['agente'])
            if b > 0:
                bits_totales += b
                self.dimensiones_activas.append('agente')
                bits_por_dimension['agente'] = round(b, 2)

        return bits_totales, self.dimensiones_activas, bits_por_dimension


# ========== MÓDULO DE VEROSIMILITUDES ==========

class CalculadorVerosimilitudes:
    """Deriva P(E|H) desde los datos del JSON."""
    
    def __init__(self, especificidad: CalculadorEspecificidad):
        self.especificidad = especificidad

    def calcular_credibilidad_total(self, profecia: Dict[str, Any]) -> float:
        factores_cred = profecia.get('factores_credibilidad', {})
        
        credibilidad = (
            factores_cred.get('claridad_textual', 0.9) *
            factores_cred.get('precision_historica', 0.9) *
            factores_cred.get('independencia_redaccional', 0.8)
        )
        
        return min(credibilidad, 1.0)

    def calcular_P_E_H1_con_detalle(self, profecia: Dict[str, Any]) -> Tuple[float, float, float, List[str], Dict[str, float]]:
        """
        Calcula P(E|H₁) = 2^(-bits_efectivos)
        bits_efectivos = bits_brutos × credibilidad
        """
        dimensiones = profecia.get('dimensiones_especificidad', {})
        bits_brutos, dimensiones_activas, bits_por_dim = self.especificidad.calcular_bits_totales(dimensiones)
        
        credibilidad = self.calcular_credibilidad_total(profecia)
        bits_efectivos = bits_brutos * credibilidad
        prob_base = 2 ** (-bits_efectivos) if bits_efectivos > 0 else 1.0
        
        factores_trans = profecia.get('factores_transmision', {})
        
        if factores_trans.get('manuscritos_pre_evento', False):
            prob_base *= 0.7
        
        estabilidad = factores_trans.get('estabilidad_textual', 1.0)
        prob_base *= (1.0 / max(estabilidad, 0.1))
        
        ev_qumran = factores_trans.get('evidencia_qumran', 0)
        prob_base *= (1.0 - 0.3 * ev_qumran)
        
        return min(prob_base, 1.0), bits_brutos, bits_efectivos, dimensiones_activas, bits_por_dim

    def calcular_P_E_H1(self, profecia: Dict[str, Any]) -> float:
        P, _, _, _, _ = self.calcular_P_E_H1_con_detalle(profecia)
        return P

    def calcular_P_E_H2(self, profecia: Dict[str, Any]) -> float:
        """
        P(E|H₂) - Revelación divina.
        """
        if profecia.get('clase') == 'C':
            return 0.3
        
        cumplimiento = profecia.get('cumplimiento', {})
        P_base = 0.85
        
        precision = cumplimiento.get('precision_observada', 5)
        P_base *= (precision / 5)
        
        testigos = cumplimiento.get('testigos_independientes', 1)
        P_base *= (1.0 + 0.1 * min(testigos, 10))
        
        ev_arq = cumplimiento.get('evidencia_arqueologica', 0.5)
        P_base *= (1.0 + ev_arq) / 1.5
        
        historicidad = cumplimiento.get('historicidad', 'alta')
        if historicidad == 'baja':
            P_base *= 0.5
        elif historicidad == 'debate':
            P_base *= 0.7
        
        return min(P_base, 1.0)

    def calcular_P_E_H3(self, profecia: Dict[str, Any]) -> float:
        """
        P(E|H₃) - Construcción posterior (antes H₄).
        Alta si hay oportunidad de editar después del evento.
        """
        oportunidad = profecia.get('oportunidad_edicion', {})
        
        # Si hay manuscritos pre-evento, H₃ es prácticamente imposible
        if oportunidad.get('manuscritos_pre_evento', False):
            return 0.001
        
        P_base = 0.08
        ventana = oportunidad.get('ventana_edicion', 0)
        
        if ventana > 150:
            P_base *= 6
        elif ventana > 100:
            P_base *= 4
        elif ventana > 50:
            P_base *= 2.5
        elif ventana > 20:
            P_base *= 1.5
        
        ev_edicion = oportunidad.get('evidencia_edicion', 0)
        P_base *= (1.0 + ev_edicion * 3)
        
        if profecia.get('clase') == 'B':
            P_base *= 0.6
        
        return min(P_base, 1.0)

    def calcular_factor_dependencia(self, profecia: Dict[str, Any],
                                   todas_profecias: List[Dict[str, Any]],
                                   hipotesis: str) -> float:
        grupo = profecia.get('correlaciones', {}).get('grupo_arquetipo', '')
        
        if not grupo:
            return 1.0
        
        mismo_grupo = [p for p in todas_profecias 
                       if p.get('correlaciones', {}).get('grupo_arquetipo') == grupo]
        
        n_mismo_grupo = len(mismo_grupo)
        
        if n_mismo_grupo <= 1:
            return 1.0
        
        if hipotesis == 'H1':
            return 1.0 / (1.0 + 0.15 * (n_mismo_grupo - 1))
        elif hipotesis == 'H2':
            return 1.0 / (1.0 + 0.5 * (n_mismo_grupo - 1))
        elif hipotesis == 'H3':
            return 1.0 / (1.0 + 0.4 * (n_mismo_grupo - 1))
        else:
            return 1.0


# ========== MOTOR BAYESIANO CON JEFFREY ==========

class InterpretadorJeffrey:
    """Interpreta factores de Bayes según escala de Jeffrey (1961)."""
    
    UMBRALES = [
        (100, "Decisiva"),
        (30, "Muy fuerte"),
        (10, "Fuerte"),
        (3, "Moderada"),
        (1, "Anecdótica/Débil")
    ]

    @classmethod
    def interpretar(cls, BF: float) -> Dict[str, Any]:
        resultado = {
            'BF': BF,
            'log10_BF': math.log10(BF) if BF > 0 else float('-inf'),
            'categoria': None,
            'descripcion': None
        }

        if BF < 1:
            BF_inv = 1 / BF if BF > 0 else float('inf')
            for umbral, cat in cls.UMBRALES:
                if BF_inv >= umbral:
                    resultado['categoria'] = f"En contra (evidencia {cat.lower()})"
                    resultado['descripcion'] = f"Evidencia {cat.lower()} en contra de H₂"
                    break
        else:
            for umbral, cat in cls.UMBRALES:
                if BF >= umbral:
                    resultado['categoria'] = f"A favor (evidencia {cat.lower()})"
                    resultado['descripcion'] = f"Evidencia {cat.lower()} a favor de H₂"
                    break

        if not resultado['categoria']:
            resultado['categoria'] = "No concluyente"
            resultado['descripcion'] = "Evidencia insuficiente"

        return resultado


class MotorBayesiano:
    """Motor de cálculos bayesianos con priors personalizables."""
    
    def __init__(self, priors: Dict[str, float]):
        # Validar que los priors sumen 1.0 (excluyendo H0)
        priors_sin_h0 = {k: v for k, v in priors.items() if k != 'H0'}
        total = sum(priors_sin_h0.values())
        if abs(total - 1.0) > 0.01:
            print(f"⚠️  Advertencia: Los priors (sin H0) suman {total}, no 1.0. Normalizando...")
            factor = 1.0 / total
            for k in priors_sin_h0:
                priors[k] *= factor
        self.priors = priors

    def calcular_LR_con_dependencia(self, P_E_Hi: float, P_E_Hj: float,
                                    fi: float, fj: float) -> float:
        if P_E_Hi <= 0 or P_E_Hj <= 0:
            return 1.0
        num = P_E_Hi ** fi if fi > 0 else 1.0
        den = P_E_Hj ** fj if fj > 0 else 1.0
        return num / den if den > 0 else float('inf')


# ========== SIMULADOR MONTE CARLO CON DEPENDENCIAS ==========

class SimuladorMonteCarlo:
    """Simula universos alternativos con dependencias por grupos de arquetipo."""
    
    def __init__(self, n_simulaciones: int = 1000000, semilla: int = 42):
        self.n_simulaciones = n_simulaciones
        random.seed(semilla)

    def simular_con_dependencias(self, profecias: List[Dict[str, Any]],
                                 P_individuales: List[float]) -> List[int]:
        """
        Simula bajo H₀ (azar puro) usando las P(E|H₁) de cada profecía.
        Modela dependencias por grupos de arquetipo.
        """
        resultados = []
        N = len(profecias)
        
        # Agrupar profecías por arquetipo
        grupos = {}
        for i, prof in enumerate(profecias):
            grupo = prof.get('correlaciones', {}).get('grupo_arquetipo', f'indiv_{i}')
            if grupo not in grupos:
                grupos[grupo] = []
            grupos[grupo].append(i)
        
        for _ in range(self.n_simulaciones):
            exitos = 0
            
            for grupo, indices in grupos.items():
                if len(indices) == 1:
                    i = indices[0]
                    if random.random() < P_individuales[i]:
                        exitos += 1
                    continue
                
                P_grupo = max(P_individuales[i] for i in indices)
                grupo_activo = random.random() < P_grupo
                
                if grupo_activo:
                    for i in indices:
                        P_corregida = min(P_individuales[i] * 1.8, 1.0)
                        if random.random() < P_corregida:
                            exitos += 1
                else:
                    for i in indices:
                        P_corregida = P_individuales[i] * 0.3
                        if random.random() < P_corregida:
                            exitos += 1
            
            resultados.append(exitos)
        
        return resultados


# ========== UTILIDADES ASCII ==========

class AsciiHistograma:
    """Genera histogramas en ASCII."""
    
    @staticmethod
    def generar(datos: List[int], titulo: str = "Distribución Monte Carlo",
               ancho: int = 60, altura: int = 15) -> str:
        if not datos:
            return ""

        min_val = min(datos)
        max_val = max(datos)
        bins = min(ancho, max_val - min_val + 1)

        if bins <= 1:
            return f"Todos los valores = {min_val}"

        counts = [0] * bins
        bin_width = (max_val - min_val) / bins

        for d in datos:
            idx = min(int((d - min_val) / bin_width), bins - 1)
            counts[idx] += 1

        max_count = max(counts)
        if max_count == 0:
            return ""

        lineas = [f"\n{titulo}"]
        lineas.append(f"Rango: {min_val} - {max_val} | Simulaciones: {len(datos)}")
        lineas.append("")

        for i in range(bins):
            bin_min = min_val + i * bin_width
            bin_max = min_val + (i + 1) * bin_width
            label = f"{int(bin_min)}-{int(bin_max)}"

            bar_height = int(counts[i] * altura / max_count)
            bar = "█" * bar_height
            pct = counts[i] / len(datos) * 100
            lineas.append(f"{label:>10} | {bar:<{altura}} {pct:5.1f}%")

        return "\n".join(lineas)

    @staticmethod
    def linea_progreso(valor: float, max_val: float, ancho: int = 40) -> str:
        if max_val <= 0:
            return ""
        pos = int(valor / max_val * ancho)
        return f"[{'=' * pos}{' ' * (ancho - pos)}] {valor:.2e}"


# ========== ORQUESTADOR PRINCIPAL ==========

class AnalizadorProfecias:
    """Orquestador principal con 3 hipótesis (H₁, H₂, H₃) + H₀."""
    
    def __init__(self, archivo_json: str, priors: Dict[str, float]):
        with open(archivo_json, 'r', encoding='utf-8') as f:
            self.data = json.load(f)

        self.profecias = self.data.get('profecias', [])
        
        # Componentes
        self.especificidad = CalculadorEspecificidad()
        self.verosimilitudes = CalculadorVerosimilitudes(self.especificidad)
        self.motor = MotorBayesiano(priors)

        # Config Monte Carlo (del JSON o por defecto)
        mc_config = self.data.get('modelo_bayesiano', {}).get('configuracion_montecarlo', {})
        self.simulador = SimuladorMonteCarlo(
            n_simulaciones=mc_config.get('n_simulaciones', 1_000_000),
            semilla=mc_config.get('semilla', 42)
        )

        self.hist_ascii = AsciiHistograma()

    def analizar(self) -> Dict[str, Any]:
        print("\n" + "="*80)
        print("ANÁLISIS BAYESIANO DE PROFECÍAS MESIÁNICAS")
        print("="*80)
        print("\nHipótesis:")
        print("  H₀: Azar puro (modelo nulo para Monte Carlo)")
        print("  H₁: Naturalismo")
        print("  H₂: Revelación divina")
        print("  H₃: Construcción posterior")
        print(f"\nPriors utilizados (deben sumar 1.0 excluyendo H₀):")
        for h, p in self.motor.priors.items():
            if h != 'H0':
                print(f"  {h}: {p:.4f}")

        # 1. Calcular P(E|H) para cada profecía
        print("\n📊 1. ANÁLISIS DE ESPECIFICIDAD Y VEROSIMILITUDES")
        print("-"*80)

        resultados_profecias = []
        P_E_H1_list = []
        especificidades_detalle = []
        k_observado = 0

        for idx, prof in enumerate(self.profecias):
            pid = prof.get('id', 'unknown')
            nombre = prof.get('nombre', '')
            clase = prof.get('clase', 'C')

            if clase == 'A':
                k_observado += 1

            P_E_H1, bits_brutos, bits_efectivos, dim_activas, bits_por_dim = self.verosimilitudes.calcular_P_E_H1_con_detalle(prof)

            P_E_H2 = self.verosimilitudes.calcular_P_E_H2(prof)
            P_E_H3 = self.verosimilitudes.calcular_P_E_H3(prof)

            fi_H1 = self.verosimilitudes.calcular_factor_dependencia(prof, self.profecias, 'H1')
            fi_H2 = self.verosimilitudes.calcular_factor_dependencia(prof, self.profecias, 'H2')
            fi_H3 = self.verosimilitudes.calcular_factor_dependencia(prof, self.profecias, 'H3')

            if idx < 5 or P_E_H1 < 0.01:
                print(f"\n  {idx+1:2d}. {pid}: {nombre} (clase {clase})")
                print(f"     📐 Bits: {bits_brutos:.2f} brutos → {bits_efectivos:.2f} efectivos")
                print(f"     📈 P(E|H₁) = {P_E_H1:.2e}, P(E|H₂) = {P_E_H2:.3f}, P(E|H₃) = {P_E_H3:.3f}")

            resultados_profecias.append({
                'id': pid,
                'nombre': nombre,
                'clase': clase,
                'bits_brutos': bits_brutos,
                'bits_efectivos': bits_efectivos,
                'P_E_H1': P_E_H1,
                'P_E_H2': P_E_H2,
                'P_E_H3': P_E_H3,
                'fi_H1': fi_H1,
                'fi_H2': fi_H2,
                'fi_H3': fi_H3
            })

            P_E_H1_list.append(P_E_H1)
            
            especificidades_detalle.append({
                'id': pid,
                'nombre': nombre,
                'bits_brutos': bits_brutos,
                'bits_efectivos': bits_efectivos
            })

        # 2. Calcular LRs totales
        print("\n\n📈 2. FACTORES DE BAYES TOTALES")
        print("-"*60)

        LR_total = {'H2': 1.0, 'H3': 1.0}

        for prof in resultados_profecias:
            if prof['clase'] == 'C':
                continue

            for h in ['H2', 'H3']:
                lr = self.motor.calcular_LR_con_dependencia(
                    prof[f'P_E_{h}'], prof['P_E_H1'],
                    prof[f'fi_{h}'], prof['fi_H1']
                )
                LR_total[h] *= lr

        for h, lr in LR_total.items():
            print(f"  LR({h}/H₁) = {lr:.3e}")

        # 3. Comparaciones con Jeffrey
        print("\n\n🎯 3. INTERPRETACIÓN SEGÚN JEFFREY")
        print("-"*60)

        comparaciones = {
            'H₂/H₁': LR_total['H2'],
            'H₃/H₁': LR_total['H3'],
            'H₂/H₃': LR_total['H2'] / LR_total['H3'] if LR_total['H3'] > 0 else float('inf')
        }

        for comp, bf in comparaciones.items():
            interp = InterpretadorJeffrey.interpretar(bf)
            print(f"\n  {comp}:")
            print(f"    BF = {bf:.3e}")
            print(f"    log₁₀(BF) = {interp['log10_BF']:.3f}")
            print(f"    → {interp['descripcion']}")

        # 4. Simulación Monte Carlo (H₀)
        print("\n\n🎲 4. SIMULACIÓN MONTE CARLO (H₀: AZAR PURO)")
        print("-"*60)
        print(f"  Simulaciones: {self.simulador.n_simulaciones:,}")
        print(f"  k observado (clase A): {k_observado} de {len(self.profecias)}")

        k_simulados = self.simulador.simular_con_dependencias(self.profecias, P_E_H1_list)

        P_conjunta = sum(1 for k in k_simulados if k >= k_observado) / len(k_simulados)

        print(f"\n  P(k ≥ {k_observado} | H₀) = {P_conjunta:.6f}")

        k_mean = sum(k_simulados) / len(k_simulados)
        k_std = (sum((k - k_mean)**2 for k in k_simulados) / len(k_simulados))**0.5
        k_sorted = sorted(k_simulados)
        k_p95 = k_sorted[int(0.95 * len(k_sorted))]
        k_p99 = k_sorted[int(0.99 * len(k_sorted))]
        k_max = max(k_simulados)

        print(f"\n  Estadísticas bajo H₀:")
        print(f"    Media: {k_mean:.2f}")
        print(f"    Desv. estándar: {k_std:.2f}")
        print(f"    Máximo: {k_max}")
        print(f"    Percentil 95: {k_p95}")
        print(f"    Percentil 99: {k_p99}")

        print("\n" + self.hist_ascii.generar(
            k_simulados,
            titulo="Distribución de profecías cumplidas por azar (H₀)",
            ancho=60, altura=15
        ))

        # 5. Probabilidades posteriores (solo H₁, H₂, H₃)
        print("\n\n📋 5. PROBABILIDADES POSTERIORES")
        print("="*60)

        LR_dict = {'H1': 1.0}
        LR_dict.update(LR_total)

        numeradores = {}
        for h, prior in self.motor.priors.items():
            if h == 'H0':
                continue
            numeradores[h] = LR_dict.get(h, 0.0) * prior

        denom = sum(numeradores.values())
        posteriores = {h: num/denom for h, num in numeradores.items()} if denom > 0 else {
            'H1': 0.33, 'H2': 0.33, 'H3': 0.34
        }

        print("\n  Probabilidades posteriores (dados los datos):")
        for h, p in posteriores.items():
            barra = self.hist_ascii.linea_progreso(p, max(posteriores.values()), 30)
            print(f"    {h}: {p:.6f} {barra}")

        hipotesis_max = max(posteriores, key=posteriores.get)
        print(f"\n  → Hipótesis más probable: {hipotesis_max}")

        # Resultado estructurado
        resultado = {
            'priors': self.motor.priors,
            'resumen': {
                'N_total': len(self.profecias),
                'N_A': k_observado,
                'N_B': sum(1 for p in resultados_profecias if p['clase'] == 'B'),
                'N_C': sum(1 for p in resultados_profecias if p['clase'] == 'C')
            },
            'factores_bayes': LR_total,
            'jeffrey': {k: InterpretadorJeffrey.interpretar(v) for k, v in comparaciones.items()},
            'montecarlo': {
                'P_conjunta': P_conjunta,
                'k_observado': k_observado,
                'k_media': k_mean,
                'k_std': k_std,
                'k_p95': k_p95,
                'k_p99': k_p99
            },
            'posteriores': posteriores,
            'hipotesis_maxima': hipotesis_max
        }

        return resultado


def parsear_priors(priors_str: str) -> Dict[str, float]:
    """Parsea string de priors en formato 'H1=0.97,H2=0.01,H3=0.02'"""
    priors = {}
    try:
        partes = priors_str.split(',')
        for parte in partes:
            if '=' not in parte:
                continue
            key, val = parte.split('=')
            priors[key.strip()] = float(val.strip())
        
        # H₀ siempre es 0.0
        priors['H0'] = 0.0
        
        # Verificar que están todas las hipótesis
        for h in ['H1', 'H2', 'H3']:
            if h not in priors:
                raise ValueError(f"Falta prior para {h}")
        
        return priors
    except Exception as e:
        print(f"Error parseando priors: {e}")
        print("Formato esperado: H1=0.97,H2=0.01,H3=0.02 (debe sumar 1.0)")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Análisis bayesiano de profecías mesiánicas (3 hipótesis)")
    parser.add_argument('--json', type=str, default='profecias.json', help='Archivo JSON de entrada')
    parser.add_argument('--output', type=str, help='Archivo JSON de salida')
    parser.add_argument('--simulaciones', type=int, default=1_000_000, help='Número de simulaciones Monte Carlo')
    parser.add_argument('--priors', type=str, required=True,
                       help='Priors en formato "H1=0.97,H2=0.01,H3=0.02" (debe sumar 1.0)')

    args = parser.parse_args()

    if not os.path.exists(args.json):
        print(f"Error: No se encuentra {args.json}")
        sys.exit(1)

    # Parsear priors
    priors = parsear_priors(args.priors)
    
    print("\n" + "="*80)
    print("CONFIGURACIÓN DEL ANÁLISIS")
    print("="*80)
    print(f"Archivo JSON: {args.json}")
    print(f"Simulaciones Monte Carlo: {args.simulaciones:,}")
    print("\nPriors (H₀ siempre 0.0):")
    for h in ['H1', 'H2', 'H3']:
        print(f"  {h}: {priors[h]:.4f}")
    print(f"  Total: {priors['H1'] + priors['H2'] + priors['H3']:.4f}")
    print("-"*80)

    # Actualizar configuración
    Config.N_SIMULACIONES = args.simulaciones

    # Ejecutar análisis
    analizador = AnalizadorProfecias(args.json, priors)
    resultado = analizador.analizar()

    # Guardar resultados
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Resultados guardados en: {args.output}")


if __name__ == '__main__':
    main()
