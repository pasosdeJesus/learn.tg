#!/usr/bin/env python3
"""
Análisis de sensibilidad para priors en evaluación de especificidad de profecías.
Explora cómo cambian los resultados con diferentes supuestos (conservadores vs. base).
"""

import math
import json
from typing import Dict, List, Optional, Union
import sys
import os

# Importar las clases del análisis original
sys.path.insert(0, os.path.dirname(__file__))
from especificidad_formal import EspecificidadProfecia, AnalizadorComparativo


# ============================================================================
# ESCENARIOS DE PARÁMETROS
# ============================================================================

class EscenarioParametros:
    """Define un conjunto de parámetros para análisis de sensibilidad."""

    def __init__(self, nombre: str, descripcion: str):
        self.nombre = nombre
        self.descripcion = descripcion
        self.parametros = {}

class ParametrosProfecia:
    """Parámetros específicos para una profecía."""

    def __init__(self):
        self.dimensiones = {}
        self.factores_reduccion = {}


# ============================================================================
# FUNCIONES DE CREACIÓN CON PARÁMETROS VARIABLES
# ============================================================================

def crear_profecia_daniel_9(
    rango_max_temporal: int = 1000,
    opciones_evento: int = 20,
    ambiguedad: float = 0.8,
    genero_literario: float = 0.9
) -> EspecificidadProfecia:
    """Crea análisis para Daniel 9:24-27 con parámetros configurables."""
    profecia = EspecificidadProfecia(
        nombre="Daniel 9:24-27",
        texto="Setenta semanas están decretadas... desde la salida de la orden para restaurar y reedificar a Jerusalén hasta el Mesías Príncipe habrá siete semanas y sesenta y dos semanas... después de las sesenta y dos semanas se quitará la vida al Mesías.",
        referencia="Daniel 9:24-27"
    )

    profecia.definir_dimension('temporal',
        valor_especifico=483,
        rango_posible_min=0,
        rango_posible_max=rango_max_temporal,
        precision_años=1,
        unidad='años',
        fuente_datos=f"Cálculo basado en años de 360 días. Rango máximo ajustado: {rango_max_temporal} años"
    )

    profecia.definir_dimension('evento',
        evento_especifico="Mesías 'cortado' (ejecutado)",
        opciones_posibles=opciones_evento,
        fuente_datos=f"Expectativas mesiánicas: {opciones_evento} destinos posibles"
    )

    profecia.definir_factor_reduccion('ambiguedad_linguistica', ambiguedad)
    profecia.definir_factor_reduccion('genero_literario', genero_literario)

    return profecia


def crear_profecia_miqueas_5(
    opciones_geograficas: int = 587,
    ambiguedad: float = 0.95,
    genero_literario: float = 0.7
) -> EspecificidadProfecia:
    """Crea análisis para Miqueas 5:2 con parámetros configurables."""
    profecia = EspecificidadProfecia(
        nombre="Miqueas 5:2",
        texto="Pero tú, Belén Efrata, aunque eres pequeña entre las familias de Judá, de ti me saldrá el que será Señor en Israel.",
        referencia="Miqueas 5:2"
    )

    profecia.definir_dimension('geografica',
        lugar_especifico="Belén Efrata",
        opciones_posibles=opciones_geograficas,
        fuente_datos=f"Asentamientos en Judea: {opciones_geograficas} lugares posibles"
    )

    profecia.definir_factor_reduccion('ambiguedad_linguistica', ambiguedad)
    profecia.definir_factor_reduccion('genero_literario', genero_literario)

    return profecia


def crear_profecia_salmo_22(
    opciones_evento: int = 50,
    ambiguedad: float = 0.6,
    genero_literario: float = 0.5
) -> EspecificidadProfecia:
    """Crea análisis para Salmo 22:16-18 con parámetros configurables."""
    profecia = EspecificidadProfecia(
        nombre="Salmo 22:16-18",
        texto="Horadaron mis manos y mis pies... repartieron entre sí mis vestidos, y sobre mi ropa echaron suertes.",
        referencia="Salmo 22:16-18"
    )

    profecia.definir_dimension('evento',
        evento_especifico="Crucifixión con sorteo de vestiduras",
        opciones_posibles=opciones_evento,
        fuente_datos=f"Métodos ejecución: {opciones_evento} opciones"
    )

    profecia.definir_factor_reduccion('ambiguedad_linguistica', ambiguedad)
    profecia.definir_factor_reduccion('genero_literario', genero_literario)

    return profecia


def crear_profecia_zecharias_11(
    rango_max_cuantitativo: int = 100,
    opciones_evento: int = 100,
    ambiguedad: float = 0.8,
    genero_literario: float = 0.7
) -> EspecificidadProfecia:
    """Crea análisis para Zacarías 11:12-13 con parámetros configurables."""
    profecia = EspecificidadProfecia(
        nombre="Zacarías 11:12-13",
        texto="Y les dije: Si les parece bien, denme mi salario; y si no, déjenlo. Ellos pesaron mi salario: treinta piezas de plata... Tomé las treinta piezas de plata y las arrojé al alfarero en la casa de Jehová.",
        referencia="Zacarías 11:12-13"
    )

    profecia.definir_dimension('cuantitativa',
        valor_especifico=30,
        rango_min=1,
        rango_max=rango_max_cuantitativo,
        unidad='piezas de plata',
        fuente_datos=f"Montos transacciones: rango 1-{rango_max_cuantitativo}"
    )

    profecia.definir_dimension('evento',
        evento_especifico="Dinero arrojado al alfarero en el Templo",
        opciones_posibles=opciones_evento,
        fuente_datos=f"Destinos dinero: {opciones_evento} opciones"
    )

    profecia.definir_factor_reduccion('ambiguedad_linguistica', ambiguedad)
    profecia.definir_factor_reduccion('genero_literario', genero_literario)

    return profecia


def crear_profecia_isaías_53(
    opciones_caracteristicas: List[int] = [10, 10, 5, 20],
    ambiguedad: float = 0.7,
    genero_literario: float = 0.6
) -> EspecificidadProfecia:
    """Crea análisis para Isaías 53 con parámetros configurables."""
    profecia = EspecificidadProfecia(
        nombre="Isaías 53",
        texto="Despreciado y desechado entre los hombres... herido fue por nuestras rebeliones, molido por nuestros pecados... por su llaga fuimos nosotros curados.",
        referencia="Isaías 53"
    )

    profecia.definir_dimension('agente',
        caracteristicas=[
            "Inocente que sufre por otros",
            "Rechazado por su pueblo",
            "Muerto como criminal",
            "Su muerte tiene valor expiatorio"
        ],
        opciones_por_caracteristica=opciones_caracteristicas,
        fuente_datos=f"Opciones por característica: {opciones_caracteristicas}"
    )

    profecia.definir_factor_reduccion('ambiguedad_linguistica', ambiguedad)
    profecia.definir_factor_reduccion('genero_literario', genero_literario)

    return profecia


# ============================================================================
# ESCENARIOS DEFINIDOS
# ============================================================================

def crear_escenario_base() -> Dict:
    """Escenario base (parámetros originales del análisis)."""
    return {
        'nombre': 'BASE',
        'descripcion': 'Parámetros originales del análisis',
        'daniel_9': {
            'rango_max_temporal': 1000,
            'opciones_evento': 20,
            'ambiguedad': 0.8,
            'genero_literario': 0.9
        },
        'miqueas_5': {
            'opciones_geograficas': 587,
            'ambiguedad': 0.95,
            'genero_literario': 0.7
        },
        'salmo_22': {
            'opciones_evento': 50,
            'ambiguedad': 0.6,
            'genero_literario': 0.5
        },
        'zecharias_11': {
            'rango_max_cuantitativo': 100,
            'opciones_evento': 100,
            'ambiguedad': 0.8,
            'genero_literario': 0.7
        },
        'isaías_53': {
            'opciones_caracteristicas': [10, 10, 5, 20],
            'ambiguedad': 0.7,
            'genero_literario': 0.6
        }
    }


def crear_escenario_conservador() -> Dict:
    """Escenario naturalista conservador (rangos más amplios, más ambigüedad)."""
    return {
        'nombre': 'CONSERVADOR',
        'descripcion': 'Supuestos naturalistas conservadores (rangos amplios, alta ambigüedad)',
        'daniel_9': {
            'rango_max_temporal': 2000,  # 2x más amplio
            'opciones_evento': 40,       # 2x más opciones
            'ambiguedad': 0.5,           # Más ambigua
            'genero_literario': 0.6      # Género menos predictivo
        },
        'miqueas_5': {
            'opciones_geograficas': 1000,  # ~2x más ciudades
            'ambiguedad': 0.7,            # Más ambigua
            'genero_literario': 0.4       # Más simbólica
        },
        'salmo_22': {
            'opciones_evento': 100,       # 2x más opciones
            'ambiguedad': 0.3,            # Mucho más ambigua
            'genero_literario': 0.3       # Género no predictivo
        },
        'zecharias_11': {
            'rango_max_cuantitativo': 500,  # 5x más amplio
            'opciones_evento': 200,       # 2x más opciones
            'ambiguedad': 0.5,            # Más ambigua
            'genero_literario': 0.4       # Alegoría menos clara
        },
        'isaías_53': {
            'opciones_caracteristicas': [20, 20, 10, 40],  # 2x más opciones
            'ambiguedad': 0.4,            # Mucho más ambigua
            'genero_literario': 0.3       # ¿Profecía o poesía?
        }
    }


def crear_escenario_intermedio() -> Dict:
    """Escenario intermedio entre base y conservador."""
    return {
        'nombre': 'INTERMEDIO',
        'descripcion': 'Supuestos balanceados (ajustes moderados)',
        'daniel_9': {
            'rango_max_temporal': 1500,
            'opciones_evento': 30,
            'ambiguedad': 0.65,
            'genero_literario': 0.75
        },
        'miqueas_5': {
            'opciones_geograficas': 800,
            'ambiguedad': 0.8,
            'genero_literario': 0.55
        },
        'salmo_22': {
            'opciones_evento': 75,
            'ambiguedad': 0.45,
            'genero_literario': 0.4
        },
        'zecharias_11': {
            'rango_max_cuantitativo': 250,
            'opciones_evento': 150,
            'ambiguedad': 0.65,
            'genero_literario': 0.55
        },
        'isaías_53': {
            'opciones_caracteristicas': [15, 15, 8, 30],
            'ambiguedad': 0.55,
            'genero_literario': 0.45
        }
    }


# ============================================================================
# ANÁLISIS POR ESCENARIO
# ============================================================================

def ejecutar_analisis_escenario(escenario: Dict) -> Dict:
    """Ejecuta análisis completo para un escenario de parámetros."""
    print(f"\n{'='*60}")
    print(f"ESCENARIO: {escenario['nombre']}")
    print(f"Descripción: {escenario['descripcion']}")
    print(f"{'='*60}")

    analizador = AnalizadorComparativo()

    # Crear profecías con parámetros del escenario
    params = escenario['daniel_9']
    analizador.agregar_profecia(crear_profecia_daniel_9(
        rango_max_temporal=params['rango_max_temporal'],
        opciones_evento=params['opciones_evento'],
        ambiguedad=params['ambiguedad'],
        genero_literario=params['genero_literario']
    ))

    params = escenario['miqueas_5']
    analizador.agregar_profecia(crear_profecia_miqueas_5(
        opciones_geograficas=params['opciones_geograficas'],
        ambiguedad=params['ambiguedad'],
        genero_literario=params['genero_literario']
    ))

    params = escenario['salmo_22']
    analizador.agregar_profecia(crear_profecia_salmo_22(
        opciones_evento=params['opciones_evento'],
        ambiguedad=params['ambiguedad'],
        genero_literario=params['genero_literario']
    ))

    params = escenario['zecharias_11']
    analizador.agregar_profecia(crear_profecia_zecharias_11(
        rango_max_cuantitativo=params['rango_max_cuantitativo'],
        opciones_evento=params['opciones_evento'],
        ambiguedad=params['ambiguedad'],
        genero_literario=params['genero_literario']
    ))

    params = escenario['isaías_53']
    analizador.agregar_profecia(crear_profecia_isaías_53(
        opciones_caracteristicas=params['opciones_caracteristicas'],
        ambiguedad=params['ambiguedad'],
        genero_literario=params['genero_literario']
    ))

    # Ejecutar análisis
    analizador.analizar_todas()

    # Extraer resultados clave
    resultados = []
    for profecia in analizador.profecias:
        resultados.append({
            'nombre': profecia.nombre,
            'bits': profecia.resultados['bits_informacion'],
            'probabilidad': profecia.resultados['probabilidad_especificidad'],
            'dimensiones': profecia.resultados['dimensiones_activas']
        })

    # Calcular estadísticas conjuntas
    bits_total = sum(r['bits'] for r in resultados)
    p_conjunta = math.prod(r['probabilidad'] for r in resultados)
    bits_producto = math.log2(1/p_conjunta) if p_conjunta > 0 else float('inf')

    return {
        'nombre': escenario['nombre'],
        'descripcion': escenario['descripcion'],
        'resultados_individuales': resultados,
        'bits_total': bits_total,
        'probabilidad_conjunta': p_conjunta,
        'bits_producto': bits_producto,
        'equivalente_1_en': 1/p_conjunta if p_conjunta > 0 else float('inf')
    }


def generar_reporte_comparativo(resultados_escenarios: List[Dict]) -> str:
    """Genera reporte comparativo entre escenarios."""
    reporte = []
    reporte.append("="*80)
    reporte.append("ANÁLISIS DE SENSIBILIDAD - COMPARATIVA DE ESCENARIOS")
    reporte.append("="*80)

    # Tabla comparativa
    reporte.append("\nRESUMEN POR ESCENARIO:")
    reporte.append("-"*80)
    reporte.append(f"{'Escenario':<15} {'Bits total':<12} {'P(conjunta)':<20} {'1 en':<20} {'Interpretación'}")
    reporte.append("-"*80)

    for res in resultados_escenarios:
        p_str = f"{res['probabilidad_conjunta']:.2e}"
        equivalente = f"{res['equivalente_1_en']:.2e}"
        bits_str = f"{res['bits_total']:.2f}"

        # Interpretación basada en probabilidad conjunta
        p = res['probabilidad_conjunta']
        if p < 1e-20:
            interpretacion = "ESPEC. EXTREMA"
        elif p < 1e-10:
            interpretacion = "ESPEC. MUY ALTA"
        elif p < 1e-6:
            interpretacion = "ESPEC. ALTA"
        elif p < 1e-3:
            interpretacion = "ESPEC. MODERADA"
        else:
            interpretacion = "ESPEC. BAJA"

        reporte.append(f"{res['nombre']:<15} {bits_str:<12} {p_str:<20} {equivalente:<20} {interpretacion}")

    # Detalles por profecía
    reporte.append("\n" + "="*80)
    reporte.append("DETALLE POR PROFECÍA (bits de información):")
    reporte.append("-"*80)

    # Obtener nombres de profecías del primer escenario
    profecias_nombres = [r['nombre'] for r in resultados_escenarios[0]['resultados_individuales']]

    # Encabezado
    header = f"{'Profecía':<20}"
    for esc in resultados_escenarios:
        header += f" {esc['nombre']:<12}"
    reporte.append(header)
    reporte.append("-"*80)

    # Filas por profecía
    for i, nombre in enumerate(profecias_nombres):
        fila = f"{nombre:<20}"
        for esc in resultados_escenarios:
            bits = esc['resultados_individuales'][i]['bits']
            fila += f" {bits:<12.2f}"
        reporte.append(fila)

    # Análisis de sensibilidad relativa
    reporte.append("\n" + "="*80)
    reporte.append("SENSIBILIDAD RELATIVA (cambio % vs. escenario BASE):")
    reporte.append("-"*80)

    # Encontrar escenario base
    base_idx = next(i for i, esc in enumerate(resultados_escenarios) if esc['nombre'] == 'BASE')
    base_result = resultados_escenarios[base_idx]

    for esc in resultados_escenarios:
        if esc['nombre'] == 'BASE':
            continue

        cambio_bits = ((esc['bits_total'] - base_result['bits_total']) / base_result['bits_total']) * 100
        cambio_p = ((esc['probabilidad_conjunta'] - base_result['probabilidad_conjunta']) / base_result['probabilidad_conjunta']) * 100

        reporte.append(f"\n{esc['nombre']}:")
        reporte.append(f"  Bits totales: {cambio_bits:+.1f}%")
        reporte.append(f"  Probabilidad conjunta: {cambio_p:+.1f}%")

        # Factor de cambio (cuántas veces más/menos probable)
        if base_result['probabilidad_conjunta'] > 0:
            factor = esc['probabilidad_conjunta'] / base_result['probabilidad_conjunta']
            reporte.append(f"  Factor de cambio: {factor:.1f}x {'más' if factor > 1 else 'menos'} probable")

    # Recomendaciones metodológicas
    reporte.append("\n" + "="*80)
    reporte.append("RECOMENDACIONES METODOLÓGICAS:")
    reporte.append("-"*80)
    reporte.append("1. PRIORS CONSERVADORES: Usar rangos amplios y factores de reducción bajos")
    reporte.append("   para evitar sobreestimar especificidad.")
    reporte.append("2. ANÁLISIS DE SENSIBILIDAD: Siempre reportar resultados con múltiples")
    reporte.append("   conjuntos de parámetros para mostrar robustez.")
    reporte.append("3. TRANSPARENCIA: Documentar fuentes y justificación de cada parámetro.")
    reporte.append("4. INDEPENDENCIA: Considerar posibles correlaciones entre dimensiones.")
    reporte.append("5. SELECCIÓN: Analizar conjunto completo de profecías, no solo 'éxitos'.")

    return "\n".join(reporte)


# ============================================================================
# ANÁLISIS UNIVARIANTE (variar un parámetro a la vez)
# ============================================================================

def analisis_univariante(parametro_variar: str, valores: List, profecia_idx: int = 0) -> List[Dict]:
    """
    Analiza sensibilidad variando un solo parámetro.

    Args:
        parametro_variar: Nombre del parámetro a variar
        valores: Lista de valores a probar
        profecia_idx: Índice de la profecía a analizar (0=Daniel, 1=Miqueas, etc.)

    Returns:
        Lista de resultados para cada valor
    """
    # Nombres de profecías
    profecia_nombres = ["Daniel 9:24-27", "Miqueas 5:2", "Salmo 22:16-18",
                       "Zacarías 11:12-13", "Isaías 53"]

    # Mapeo de índices a funciones y claves de parámetros
    profecia_configs = [
        {
            'func': crear_profecia_daniel_9,
            'params_key': 'daniel_9',
            'param_mapping': {
                'rango_max_temporal': 'rango_max_temporal',
                'opciones_evento': 'opciones_evento',
                'ambiguedad': 'ambiguedad',
                'genero_literario': 'genero_literario',
                'opciones_geograficas': None,  # No aplica
                'rango_max_cuantitativo': None,
                'opciones_caracteristicas': None
            }
        },
        {
            'func': crear_profecia_miqueas_5,
            'params_key': 'miqueas_5',
            'param_mapping': {
                'opciones_geograficas': 'opciones_geograficas',
                'ambiguedad': 'ambiguedad',
                'genero_literario': 'genero_literario',
                'rango_max_temporal': None,
                'opciones_evento': None,
                'rango_max_cuantitativo': None,
                'opciones_caracteristicas': None
            }
        },
        {
            'func': crear_profecia_salmo_22,
            'params_key': 'salmo_22',
            'param_mapping': {
                'opciones_evento': 'opciones_evento',
                'ambiguedad': 'ambiguedad',
                'genero_literario': 'genero_literario',
                'rango_max_temporal': None,
                'opciones_geograficas': None,
                'rango_max_cuantitativo': None,
                'opciones_caracteristicas': None
            }
        },
        {
            'func': crear_profecia_zecharias_11,
            'params_key': 'zecharias_11',
            'param_mapping': {
                'rango_max_cuantitativo': 'rango_max_cuantitativo',
                'opciones_evento': 'opciones_evento',
                'ambiguedad': 'ambiguedad',
                'genero_literario': 'genero_literario',
                'rango_max_temporal': None,
                'opciones_geograficas': None,
                'opciones_caracteristicas': None
            }
        },
        {
            'func': crear_profecia_isaías_53,
            'params_key': 'isaías_53',
            'param_mapping': {
                'opciones_caracteristicas': 'opciones_caracteristicas',
                'ambiguedad': 'ambiguedad',
                'genero_literario': 'genero_literario',
                'rango_max_temporal': None,
                'opciones_geograficas': None,
                'opciones_evento': None,
                'rango_max_cuantitativo': None
            }
        }
    ]

    resultados = []

    for valor in valores:
        # Crear analizador con parámetros base
        analizador = AnalizadorComparativo()

        # Parámetros base para todas las profecías
        escenario_base = crear_escenario_base()

        # Crear todas las profecías
        for i, config in enumerate(profecia_configs):
            params = escenario_base[config['params_key']].copy()

            # Si esta es la profecía que estamos variando, aplicar el cambio
            if i == profecia_idx:
                param_key = config['param_mapping'].get(parametro_variar)
                if param_key is not None:
                    params[param_key] = valor
                else:
                    print(f"Advertencia: Parámetro '{parametro_variar}' no aplica a {profecia_nombres[profecia_idx]}")
                    continue

            # Crear profecía con parámetros
            profecia = config['func'](**params)
            analizador.agregar_profecia(profecia)

        # Ejecutar análisis
        analizador.analizar_todas()

        # Extraer resultado de la profecía variada
        if profecia_idx < len(analizador.profecias):
            profecia = analizador.profecias[profecia_idx]
            resultados.append({
                'parametro': parametro_variar,
                'valor': valor,
                'nombre_profecia': profecia_nombres[profecia_idx],
                'bits': profecia.resultados['bits_informacion'],
                'probabilidad': profecia.resultados['probabilidad_especificidad']
            })
        else:
            print(f"Error: No se pudo acceder a profecía índice {profecia_idx}")

    return resultados


def generar_reporte_univariante(resultados_univariante: List[Dict]) -> str:
    """Genera reporte de análisis univariante."""
    if not resultados_univariante:
        return "No hay resultados de análisis univariante."

    parametro = resultados_univariante[0]['parametro']
    profecia = resultados_univariante[0]['nombre_profecia']

    reporte = []
    reporte.append(f"\n{'='*60}")
    reporte.append(f"ANÁLISIS UNIVARIANTE: {parametro}")
    reporte.append(f"Profecía: {profecia}")
    reporte.append(f"{'='*60}")

    reporte.append(f"\n{'Valor':<15} {'Bits':<12} {'Probabilidad':<20} {'Cambio % (vs. primer valor)'}")
    reporte.append("-"*60)

    primer_valor = resultados_univariante[0]['bits']

    for res in resultados_univariante:
        cambio = ((res['bits'] - primer_valor) / primer_valor) * 100 if primer_valor != 0 else 0
        reporte.append(f"{res['valor']:<15} {res['bits']:<12.2f} {res['probabilidad']:<20.2e} {cambio:+.1f}%")

    # Calcular elasticidad (cambio porcentual en bits / cambio porcentual en parámetro)
    if len(resultados_univariante) >= 2:
        primer = resultados_univariante[0]
        ultimo = resultados_univariante[-1]

        cambio_bits_pct = ((ultimo['bits'] - primer['bits']) / primer['bits']) * 100
        cambio_param_pct = ((ultimo['valor'] - primer['valor']) / primer['valor']) * 100

        if cambio_param_pct != 0:
            elasticidad = cambio_bits_pct / cambio_param_pct
            reporte.append(f"\nElasticidad: {elasticidad:.3f} (cada 1% cambio en parámetro produce {elasticidad:.2f}% cambio en bits)")

    return "\n".join(reporte)


# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

def main():
    """Función principal: ejecuta análisis completo de sensibilidad."""
    print("ANÁLISIS DE SENSIBILIDAD PARA PRIORS EN EVALUACIÓN DE PROFECÍAS")
    print("="*80)

    # Definir escenarios
    escenarios = [
        crear_escenario_base(),
        crear_escenario_intermedio(),
        crear_escenario_conservador()
    ]

    # Ejecutar análisis por escenario
    resultados_escenarios = []
    for escenario in escenarios:
        resultado = ejecutar_analisis_escenario(escenario)
        resultados_escenarios.append(resultado)

    # Generar reporte comparativo
    reporte_comparativo = generar_reporte_comparativo(resultados_escenarios)
    print(reporte_comparativo)

    # Análisis univariante para parámetros clave
    print("\n" + "="*80)
    print("ANÁLISIS UNIVARIANTE (PARÁMETROS CLAVE)")
    print("="*80)

    # Variar rango temporal en Daniel
    print("\n1. Sensibilidad a rango temporal (Daniel 9:24-27):")
    valores_rango = [500, 1000, 1500, 2000, 2500]
    resultados_rango = analisis_univariante('rango_max_temporal', valores_rango, 0)
    print(generar_reporte_univariante(resultados_rango))

    # Variar opciones geográficas en Miqueas
    print("\n2. Sensibilidad a opciones geográficas (Miqueas 5:2):")
    valores_geo = [300, 587, 800, 1000, 1500]
    resultados_geo = analisis_univariante('opciones_geograficas', valores_geo, 1)
    print(generar_reporte_univariante(resultados_geo))

    # Variar ambigüedad en Salmo 22
    print("\n3. Sensibilidad a ambigüedad lingüística (Salmo 22:16-18):")
    valores_amb = [0.3, 0.5, 0.7, 0.9]
    resultados_amb = analisis_univariante('ambiguedad', valores_amb, 2)
    print(generar_reporte_univariante(resultados_amb))

    # Guardar resultados en JSON
    output_file = "ia/sensibilidad_resultados.json"
    datos_guardar = {
        'escenarios': resultados_escenarios,
        'analisis_univariante': {
            'rango_temporal': resultados_rango,
            'opciones_geograficas': resultados_geo,
            'ambiguedad': resultados_amb
        }
    }

    with open(output_file, 'w') as f:
        json.dump(datos_guardar, f, indent=2, ensure_ascii=False)

    print(f"\nResultados guardados en: {output_file}")

    # Conclusiones clave
    print("\n" + "="*80)
    print("CONCLUSIONES CLAVE:")
    print("="*80)
    print("1. Los resultados son SENSIBLES a la elección de priors.")
    print("2. Supuestos conservadores (naturalistas) reducen significativamente")
    print("   la especificidad aparente.")
    print("3. La transparencia en priors es esencial para evaluación objetiva.")
    print("4. Se recomienda usar múltiples escenarios y análisis de sensibilidad")
    print("   para presentar conclusiones robustas.")


if __name__ == "__main__":
    main()