# María — Referencia de la Ley General de Minería (Decreto 238-2012)

> Documento de referencia normativa para el asistente virtual María.
> Creado por el Playbook CC (Capa de Vigencia, 2026-08) — este archivo no
> existía antes; nace con la Sección 0 como capa fundacional. Todo contenido
> futuro sobre la Ley General de Minería que se agregue a este documento
> queda subordinado a la Sección 0.

## 0. VIGENCIA NORMATIVA (leer antes que todo)

La Sala de lo Constitucional de la Corte Suprema de Justicia, en sentencia de
fecha 18 de marzo de 2026, expediente SCO-0090-2014 (recurso IDAMHO 2014),
publicada en La Gaceta No. 37,158 del 3 de junio de 2026, resolvió sobre la
constitucionalidad de la Ley General de Minería, Decreto 238-2012 (publicada
en La Gaceta No. 33,088, 2 de abril de 2013).

### 0.1 Tabla de vigencia

| Grupo | Artículos de la Ley | Estado |
|---|---|---|
| Anulados [ANULADO — SCO-0090-2014] | 22, 39, 43, 47, 48, 67, 68 | Declarados inconstitucionales. NO citables como derecho vigente. |
| Validados (varios con condiciones interpretativas) | 36, 49, 53 (incisos b, f, h, i, j, k), 55, 56, 60, 61, 66, 70, 76, 77, 86, 111 | Constitucionales. El 86 fue validado expresamente. |
| No impugnados | Todo el resto de la Ley — incluidos los que usa la plataforma: 8, 13, 18, 24–26, 37, 38, 44, 45, 46 | Siguen vigentes ordinariamente. |

Detalle de los artículos anulados [ANULADO — SCO-0090-2014]:

- **22** — plazos de concesión sin límite máximo.
- **39** — profundidad indefinida.
- **43** — límite de 10 concesiones (riesgo oligopólico).
- **47** — minerales adicionales (adición automática de sustancias).
- **48** — zonas excluidas (condicionadas a catálogo inexistente; el
  considerando precisa "en la parte que condiciona protección a catálogos
  inexistentes" más la ambigüedad de "vocación turística" — para efectos
  operativos se trata como NO CITABLE como derecho vigente).
- **67 y 68** — régimen de consulta ciudadana (restricción indebida de
  alcance y momento; exclusión de comunidades afectadas).

Condiciones interpretativas destacadas de los validados:

- **36** — constitucional solo bajo interpretación restrictiva (control
  estatal efectivo, prohibición de métodos ambientalmente destructivos).
- **53, inciso h** — confidencialidad constitucional con la precisión de que
  la información ambiental relevante debe ser siempre accesible.
- **55** — caución constitucional siempre que resulte suficiente y
  proporcional al riesgo.
- **56, 76, 77** — constitucionales por sí mismos; exhortación a revisar
  cánones y tributos.
- **86** — VALIDADO EXPRESAMENTE: definición de pequeña minería ("medios
  mecánicos sencillos", 200 t/día en metálicas, 50 m³/día en placer
  metálico). Refuerza el criterio clasificador "la técnica, no el lugar".

### 0.2 Efectos y exhortación

- **Efectos**: ex nunc (Art. 316 constitucional), erga omnes, sin afectar
  situaciones jurídicas definitivamente ejecutadas. No retroactivos.
- **Exhortación al Congreso Nacional (sin plazo)**: a) límites temporales de
  concesiones; b) mecanismos efectivos de consulta previa a pueblos
  indígenas; c) régimen tributario equitativo; d) catálogo real de áreas
  protegidas.
- **Precedentes citados como doctrina vinculante**: RI-172-06 (2017);
  RI-089-16 (15 de marzo de 2018) — toda actividad extractiva que pueda
  afectar territorios o recursos tradicionalmente utilizados por pueblos
  indígenas requiere consulta previa, libre e informada, derecho fundamental
  e irrenunciable (Arts. 173 y 346 CN, Convenio 169 OIT); Saramaka (2007) y
  Kaliña y Lokono (2015) vía bloque de constitucionalidad (Art. 16 CN).

### 0.3 Regla de precedencia

Si cualquier sección posterior de este documento cita un artículo anulado,
**esta Sección 0 prevalece** y María no debe citarlo como derecho vigente.

### 0.4 Reglas de respuesta de María

1. **R1** — Nunca citar como derecho vigente los Arts. 22, 39, 43, 47, 48, 67
   y 68 de la Ley General de Minería [ANULADO — SCO-0090-2014]. Si el tema
   los toca: fueron declarados inconstitucionales (Gaceta No. 37,158,
   3 de junio de 2026) y el Congreso Nacional fue exhortado a legislar de
   nuevo.
2. **R2** — "Art. 47" siempre como "Art. 47, literal (a), del Reglamento
   Especial MAPE"; nunca el 47 de la Ley (anulado).
3. **R3** — Consulta previa: usar `NOTA_CONSULTA_PREVIA`
   (`lib/legal/vigenciaLGM.ts`) textual. María no asesora cómo ejecutar una
   consulta ni opina sobre si un expediente concreto la requiere — entrega
   criterios y artículo; resolver corresponde a la autoridad; deriva al
   canal formal (gerencia@mape.legal).
4. **R4** — Efectos ex nunc: la sentencia no afecta situaciones
   definitivamente ejecutadas. María nunca opina sobre la validez de
   permisos o concesiones ya otorgados.
5. **R5** — El Art. 86 (definición de pequeña minería) fue validado
   expresamente: puede citarse con confianza para la clasificación técnica
   artesanal / pequeña minería.

### 0.5 Referencias

- Constantes tipadas: `lib/legal/vigenciaLGM.ts` (`SENTENCIA_LGM`,
  `LGM_ARTICULOS_ANULADOS`, `LGM_ARTICULOS_VALIDADOS`,
  `NOTA_CONSULTA_PREVIA`).
- Resumen neutral de la sentencia: `docs/legal/sentencia-sco-0090-2014.md`.
- Bloque operativo en el prompt: `lib/maria/systemPrompt.ts`
  §VIGENCIA NORMATIVA — SENTENCIA SCO-0090-2014 (espejo en MARIA.md §15).
- El texto auténtico de la sentencia es el publicado en La Gaceta
  No. 37,158 (3 de junio de 2026).

---

*No hay secciones posteriores todavía. Cualquier contenido de la Ley General
de Minería que se agregue debajo debe pasar `npm run check:copy` (reglas de
vigencia) y respetar la regla de precedencia de la Sección 0.*
