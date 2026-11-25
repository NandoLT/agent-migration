# Agent Migration — Especificación de producto y técnica

- **Versión:** 0.1.0 (especificación inicial) · **Fecha:** 2026-11-25
- **Estado:** prueba de concepto manual validada; plugin pendiente de implementación.
- **Proyecto:** `agent-migration` · Destino previsto: `~/Projects/agent-migration`
- **Nombre público:** Agent Migration · Subtítulo: Session portability for ORCA.
- **Licencia propuesta:** MIT, pendiente de aprobación.

> Edición pública: los nombres de proyectos y las rutas de la prueba real se han sustituido por ejemplos. No contiene transcripciones, credenciales ni archivos de sesiones.

## 1. Encargo al agente de desarrollo

Construir un plugin independiente para ORCA que permita importar conversaciones de OpenAI Codex a OpenCode 2 desde el equipo del usuario, sin perder el contexto textual y sin alterar los originales. No modificar el código de ORCA salvo que se demuestre que su extensión no permite una función esencial y el propietario autorice otra vía.

Trabajar en español de España. El propietario prefiere procesos interactivos de **un paso cada vez**, esperando confirmación antes del siguiente. Puede autorizar lotes de acciones cuando el riesgo y las pruebas lo permitan. Priorizar desarrollo por especificaciones, entregas pequeñas, pruebas reproducibles y revisión independiente de cambios delicados. No publicar, hacer push, instalar herramientas, ampliar permisos o efectuar operaciones destructivas por inferencia. Antes de implementar, inspeccionar el repositorio, validar el SDK y proponer el primer alcance. No afirmar que un control funciona sin haberlo probado.

Esta especificación distingue **hechos verificados durante la migración manual**, **requisitos de producto** y **decisiones técnicas propuestas**. No convertir hipótesis en acuerdos. Los ejemplos contienen identificadores de laboratorio, no credenciales. No incorporar históricos reales ni rutas personales al repositorio público.

## 2. Problema y propuesta de valor

Cambiar de agente de programación implica perder continuidad si las conversaciones están vinculadas a un formato propietario. El usuario migró de Codex a ORCA + OpenCode: el código y Git permanecieron en sus repositorios, pero fue necesario recuperar el histórico, clasificarlo, consolidar decisiones y transformar conversaciones al formato de destino.

Agent Migration debe reducir ese proceso manual a un asistente gráfico, local, auditable y reversible. La importación nativa y la consolidación semántica son capacidades distintas. Importar mensajes no garantiza que el modelo pueda cargarlos todos en su ventana de contexto ni que se reproduzca el estado interno del agente original.

### Objetivos del MVP (0.1)

- Detectar OpenCode 2 y archivos locales de Codex, incluyendo sesiones archivadas.
- Agrupar fragmentos por ID de hilo, clasificarlos, identificar duplicidades y permitir seleccionar conversaciones y asociarlas a proyectos actuales.
- Previsualizar títulos, fechas, recuentos por rol, omisiones, advertencias y destinos antes de escribir.
- Preservar originales y crear respaldo verificable del destino antes de importar.
- Convertir mensajes textuales a JSON compatible con OpenCode 2.4.1 y usar su CLI oficial para importar.
- Reexportar y verificar contenido, roles, destino e identidad; mostrar resultados por conversación.
- Evitar duplicados al repetir la operación; permitir recuperación ante fallos parciales.
- Mantener todo el proceso local y sin llamadas a modelos ni consumo de créditos.

### Fuera del MVP

- Restauración exacta de herramientas, imágenes, adjuntos, razonamiento interno, snapshots, permisos, contexto oculto, tokens o estado de ejecución de Codex.
- Manipulación directa de SQLite, autenticación a OpenAI, sincronización remota, importación de chats alojados solo en la nube.
- Generación automática con IA de memoria semántica, adaptación de skills/MCP, migración inversa o soporte de otros agentes.
- Publicación en catálogo de ORCA hasta comprobar el mecanismo vigente.

## 3. Evidencia de la prueba de concepto

Entorno: Omarchy (Arch Linux), ORCA con OpenCode 2, OpenCode CLI **v2.4.1** instalado mediante mise. El proceso manual se completó el 25 de noviembre de 2026. ORCA detectaba los históricos de Codex; posteriormente mostró conversaciones convertidas en el historial nativo de OpenCode y el usuario confirmó su presencia mediante `/resume` en cada proyecto.

| Proyecto | Archivos origen | Principales | Subagentes | Guardian | Mensajes usuario | Mensajes asistente | Total nativo |
|---|---:|---:|---:|---:|---:|---:|---:|
| Proyecto A | 46 | 2 | 20 | 24 | 90 | 206 | 296 |
| Proyecto B | 24 | 1 | 9 | 14 | 118 | 176 | 294 |
| Proyecto C | 30 | 1 | 6 | 23 | 137 | 304 | 441 |
| Total | 100 | 4 | 35 | 61 | 345 | 686 | 1031 |

Los dos archivos principales de Proyecto A compartían ID de hilo, con 155 y 141 mensajes respectivamente, sin IDs duplicados ni ausentes. Por ello se importaron **tres conversaciones**, no cuatro. Los otros 96 archivos permanecieron como históricos consultables. Los 100 archivos ocupaban aproximadamente 673 MiB; se extrajeron 2.881 mensajes a Markdown (~10,6 MiB); los archivos principales y de subagentes sumaban aproximadamente 1,34 MiB. El índice general tenía 192 entradas, de las que solo se recuperaron títulos para 65 de los 100 archivos inicialmente; no asumir que un nombre de archivo identifica el hilo correctamente.

Se validó primero una sesión sintética, después una sesión real de 141 mensajes en un proyecto temporal y finalmente las tres conversaciones en sus destinos. La reexportación confirmó los recuentos y projectID correctos. La fecha de creación se preservó en el ensayo real, pero OpenCode actualizó la fecha de modificación. Se observaron etiquetas de interfaz propias de Codex como `::browser-complete`, mostradas como texto plano. La visibilidad por `/resume` está comprobada; no se probó la continuidad de inferencia dentro de cada hilo importado ni la equivalencia exacta por hash de todos los mensajes. El conversor de laboratorio usó un modelo OpenAI como metadato de compatibilidad, no como identidad histórica verificada.

### Correspondencia de proyectos utilizada (solo ejemplo de laboratorio)

| Origen histórico | Directorio de destino |
|---|---|
| `~/Projects/ejemplo-a-antiguo`, `~/.codex/worktrees/rama-ejemplo/ejemplo-a-app` | `~/Projects/ejemplo-a-app` |
| `~/Projects/ejemplo-b` | `~/Projects/ejemplo-b` |
| `~/Documents/ejemplo-c-antiguo` | `~/Projects/ejemplo-c` |

Proyecto A también tiene `~/Projects/ejemplo-a-docs` para documentación y diseño; el destino nativo fue el repositorio `ejemplo-a-app`. Esto demuestra que el nombre/ruta de un histórico no siempre coincide con el proyecto actual. La asociación debe ser editable y confirmada; jamás inferirla solo por coincidencias de palabras.

## 4. UX del plugin

Propuesta de panel integrado en ORCA, respetando tema claro/oscuro y estilos del host. No exigir un diseño externo si el SDK dispone de componentes propios. Interfaz inicialmente en inglés con posibilidad de español mediante recursos de traducción; confirmar idiomas antes de publicar.

```text
┌─ Agent Migration ───────────────────────────────┐
│ Session portability for ORCA          v0.1.0    │
│ Source      [ OpenAI Codex          ▾ ]          │
│             ~/.codex/sessions  ✓                │
│ Destination [ OpenCode 2           ▾ ] 2.4.1    │
│ [Scan sessions]                                  │
│                                                  │
│ Detected projects / threads                      │
│ ☑ Proyecto A        2 fragments · 296 messages   │
│   Destination: ejemplo-a-app              [Edit]  │
│ ☑ Proyecto B                      294 messages   │
│ ☑ Proyecto C                      441 messages   │
│                                                  │
│ Options                                          │
│ ☑ Preserve originals    ☑ Merge fragments        │
│ ☑ Backup destination    ☑ Prevent duplicates     │
│ ☐ Include subagents     ☐ Include Guardian       │
│                                                  │
│ Preview: 3 conversations · 1,031 messages         │
│ Auxiliary archives: 96 · unsupported data: ...    │
│ [Review details]              [Import selected]   │
└──────────────────────────────────────────────────┘
```

Flujo: detectar entorno → escanear → revisar agrupación y destino → vista previa (dry run) → confirmar respaldo/importación → progreso por conversación → verificación y reporte final → abrir historial si la API lo permite, o indicar `/resume`.

La inclusión de subagentes y Guardian se muestra como posibilidad de producto futura; en el MVP mantenerlos archivados y deshabilitar controles no implementados con explicación. Respaldo, preservación y prevención de colisiones deben ser invariantes, no opciones que permitan un comportamiento inseguro. Mostrar mensajes de error comprensibles, ruta de respaldo, resultado parcial, reintento, cancelación entre sesiones y exportación de informe. No mostrar contenido sensible en logs, ni previews completas sin petición expresa. Accesibilidad: teclado, foco, etiquetas y estados no dependientes solo del color.

## 5. Arquitectura propuesta

TypeScript para motor y adaptadores; Node.js para filesystem/CLI; TSX para UI si el SDK de ORCA lo admite. React, gestor de paquetes, bundler y estructura exacta pendientes de verificar con SDK. No introducir Python como dependencia de ejecución del plugin: los scripts Python de laboratorio sirven de referencia.

```mermaid
flowchart TD
    UI[ORCA Plugin UI] --> W[Worker / bridge autorizado]
    W --> E[Migration Engine]
    E --> C[Codex source adapter: JSONL]
    C --> N[Normalized threads and messages]
    N --> P[Mapping / plan / validation]
    P --> B[Backup and manifest]
    B --> O[OpenCode destination adapter: CLI]
    O --> V[Re-export and verification]
    V --> R[Report / UI]
```

Propuesta de módulos (no imponer antes de comprobar el SDK):

```text
agent-migration/
  AGENTS.md
  README.md
  docs/
    specification.md
    architecture.md
    adr/
    plans/
    compatibility.md
  src/
    core/             # dominio puro, agrupación, IDs, plan
    adapters/codex/    # descubrimiento y parser streaming
    adapters/opencode/ # schema v2, CLI, exportación y verificación
    infrastructure/   # FS, procesos, respaldo, manifiestos
    ui/               # panel y estados
    worker/           # puente con permisos mínimos
  tests/
    fixtures/         # sintéticas, nunca sesiones reales
    unit/
    integration/
    e2e/
```

Formato intermedio sugerido: `SourceThread { source, originalThreadId, fragments[], title?, messages[], createdAt, updatedAt, classification, warnings[] }`, `Message { originalId?, role, timestamp, textParts[], unsupportedParts[], provenance }`, `MigrationPlan { version, sourceFingerprint, targetProjectID, targetDirectory, entries[], warnings[] }`. Mantener procedencia (archivo, línea, ID, fecha) en manifiesto local separado; no introducirla en el texto conversacional salvo marcador necesario de contenido omitido.

Adaptadores separados de UI y de infraestructura; permitir futuros orígenes/destinos sin cambiar el dominio. Interfaces para descubrimiento, lectura, planificación, conversión, importación y verificación. Procesamiento streaming de JSONL, concurrencia limitada y cancelación; no cargar centenares de MB en memoria. No ejecutar herramientas que aparezcan en históricos.

## 6. Formato Codex y extracción

Rutas observadas: `${CODEX_HOME:-$HOME/.codex}/sessions`, `archived_sessions`, `session_index.jsonl`; permitir ubicación manual. El primer registro era `session_meta`, con `payload.id`, `payload.timestamp`, `payload.cwd`, `payload.source`. Verificar esta premisa y manejar archivos desconocidos, truncados o malformados sin saltarlos silenciosamente.

```json
{"type":"session_meta","payload":{"id":"original-thread-id","timestamp":"2026-11-21T20:29:07.724Z","cwd":"/example/old-project","source":"vscode"}}
{"type":"response_item","timestamp":"2026-11-21T20:30:00Z","payload":{"type":"message","role":"user","id":"original-message-id","content":[{"type":"input_text","text":"Example"}]}}
```

Clasificación observada: `source: "vscode"` principal; `source.subagent.thread_spawn` auxiliar con `parent_thread_id`, `depth`, `agent_path`, `agent_nickname`, `agent_role`; `source.subagent.other == "guardian"` revisión de seguridad. Otros valores de source deben quedar como desconocidos hasta confirmar su significado; no limitar universalmente los hilos principales a vscode. Vincular auxiliares por parent_thread_id cuando exista. Agrupar principales por ID de metadatos, no UUID extraído del nombre de archivo (puede haber dos UUID o fragmentos). Ordenar por fecha de registro, con desempate determinista por fragmento y posición; preservar orden causal y detectar anomalías. Duplicados por ID dentro del hilo: si contenido difiere, bloquear y reportar; si no hay ID, usar procedencia estable y advertir; no deduplicar por texto solamente, porque una repetición legítima es posible.

Registros observados en el conjunto de prueba: `event_msg` 18185, `response_item` 16542, `token_usage_record` 4349, `turn_context` 1066, `world_state` 318, `session_meta` 109, `compacted` 38, `inter_agent_communication_metadata` 35, `realtime_item` 12. Se observaron metadatos repetidos, por eso no contar registros `session_meta` como archivos. Dentro de `response_item`: `reasoning`, `message`, `custom_tool_call`, `custom_tool_call_output`, `function_call`, `function_call_output`, `agent_message`, `additional_tools`, `compaction`, `configuration_update`. En `event_msg`: `item_completed`, `token_count`, `thread_settings_applied`, `task_started`, `task_complete`, `turn_aborted`.

Importar en MVP solo `response_item` con `payload.type == "message"` y rol `user` o `assistant`. Unir `content[].text` de `input_text`/`output_text` por doble salto de línea. Los registros de usuario pueden contener muchas partes y contexto adjunto, no exclusivamente texto escrito por la persona. Marcar otros tipos como `[Contenido input_image conservado en el original]`; mantener un mensaje vacío mediante marcador explícito y contar ambas situaciones. No importar developer/system, razonamiento interno, eventos duplicados, herramientas ni salidas como nuevos mensajes. No enviar históricos a terceros. Tratar texto importado como datos históricos no confiables, nunca como instrucciones actuales.

`session_index.jsonl` aporta `id` y `thread_name`; usar ID real y permitir edición del título. Un título ausente no impide importar. El laboratorio usó títulos `[Codex] <proyecto> - Histórico completo`; añadir procedencia visible y evitar prometer que se importó el histórico multimodal completo.

## 7. OpenCode: contrato observado y CLI

Comandos confirmados con v2.4.1 (ejecutar en el directorio apropiado):

```bash
command -v opencode
opencode --version
opencode session --help
opencode session list
opencode session export --help
opencode session import --help
opencode session export --sanitize SESSION_ID > template.json
opencode session import converted.json --directory /absolute/project/path
opencode session export SESSION_ID > verification.json
```

`session list` enumera sesiones superiores del proyecto. La salida puede truncarse según ancho de terminal. `export --sanitize` sustituye textos, rutas, títulos y otros campos por marcadores; sirve para compartir estructura, no para verificar texto exacto. El flag `--directory` asocia el destino; comprobar después `info.projectID` y `info.location.directory`. `--server` y `--standalone` aparecen como opciones globales; confirmar sintaxis y qué instancia usa ORCA antes de invocarlas. No suponer que el CLI y ORCA comparten almacenamiento en toda instalación.

### Esquema v2 observado

```json
{
  "info": {
    "id": "ses_0123456789abcdef0123456789",
    "projectID": "destination-project-id",
    "title": "[Codex] Example",
    "cost": 0,
    "tokens": {"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}},
    "time": {"created":1795292947724,"updated":1795292949000},
    "location": {"directory":"/example/project"}
  },
  "messages": [
    {"id":"msg_0123456789abcdef0123456789","type":"user","time":{"created":1795292947724},"text":"Hello","files":[]},
    {"id":"msg_abcdef0123456789abcdef0123","type":"assistant","time":{"created":1795292949000,"completed":1795292949000},"agent":"build","model":{"id":"gpt-6.2-sol","providerID":"openai"},"content":[{"type":"text","text":"Hello back"}],"finish":"stop","cost":0,"tokens":{"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}}}
  ]
}
```

Este formato mínimo funcionó en la prueba de importación real. Las exportaciones nativas también incluían `model-switched`, `idle`, `snapshot`, `native`, `rawFinish`, `outcome`, tiempo de streaming, herramientas y razonamiento. No copiar esos valores de una plantilla ajena ni inventar evidencia de ejecución. Coste/tokens cero son placeholders del importador, no métricas históricas. El modelo de compatibilidad mostrado fue aceptado, pero debe parametrizarse o descubrirse de una sesión del destino y documentarse como tal; no prometer que identifica el modelo original. Investigar si la versión soporta omitir modelo o indicar uno histórico sin falsear metadatos.

ID determinista de laboratorio: prefijo `ses_` o `msg_` + primeros 26 caracteres hexadecimales SHA-256. OpenCode 2.4.1 aceptó esos IDs. Para producto, definir espacio de nombres versionado con origen, ID de hilo y destino, verificar colisiones y no sobrescribir una sesión existente. No asumir que otras versiones aceptan el formato. Crear matriz de compatibilidad por versión y fixtures.

## 8. Scripts de laboratorio reproducibles

Son referencia de comportamiento, no código de producción; no ejecutarlos sobre datos reales sin revisar permisos, secretos, rutas y respaldos. Usar Bash para bloques heredoc. Los comandos de inspección no requieren IA.

### 8.1 Inventario y títulos

```bash
find ~/.codex/sessions ~/.codex/archived_sessions -type f -name '*.jsonl' \
  -exec head -n 1 {} \; |
  jq -r 'select(.type=="session_meta") | .payload.cwd // empty' |
  sort | uniq -c | sort -nr
jq -r '[.id,.thread_name] | @tsv' ~/.codex/session_index.jsonl
```

El inventario se complementó con `rg -l -i 'Proyecto C'` para localizar referencias históricas y con revisión manual de directorios y títulos. `git worktree list` y `git status --short` distinguieron worktrees limpios de desarrollos pendientes. No es necesario modificar Git en el plugin.

### 8.2 Respaldo utilizado manualmente

```bash
umask 077
mkdir -p ~/Backups
cp -a ~/.codex ~/Backups/codex-$(date +%F)
chmod -R go-rwx ~/Backups/codex-$(date +%F)
# Después de cerrar ORCA, se respaldó OpenCode:
cp -a ~/.local/share/opencode ~/Backups/opencode-$(date +%F-%H%M%S)
```

**Mejora obligatoria:** la copia manual de Codex incluía `auth.json` y otros datos sensibles y la de OpenCode no acreditó consistencia SQLite con servicios activos. No replicar ciegamente esa estrategia en el producto. Respaldar sesiones necesarias, preferir exportaciones nativas verificadas y, si se respalda almacenamiento SQLite, usar método consistente soportado o detener servicios con aprobación. Respetar XDG, configuración y overrides; no copiar credenciales por defecto. Comprobar espacio, permisos privados, integridad y no sobreescritura. No borrar originales ni restaurar automáticamente toda la base.

### 8.3 Clasificación y conversor de referencia

El siguiente script combina los pasos manuales de descubrimiento, agrupación y conversión. Genera JSON por hilo en una carpeta privada, sin importar ni modificar originales. Se ejecuta como `python3 convert.py SOURCE_ROOT DEST_DIR PROJECT_ID OUTPUT_DIR`, donde SOURCE_ROOT contiene únicamente los archivos de un proyecto ya seleccionado, como `~/AI-Migration/ejemplo-a/sessions`. Es una adaptación documentada del conversor exitoso, no un script adicional validado en el equipo. El producto debe portar sus reglas a TypeScript, añadir pruebas y controles de seguridad.

```python
import json, hashlib, sys, os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

os.umask(0o077)
source, dest, project_id, output = sys.argv[1:]
source, dest, output = map(Path, (source, dest, output))
output.mkdir(parents=True, exist_ok=True, mode=0o700)

def ms(s):
    return int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()*1000)

def ident(prefix, value):
    return prefix + hashlib.sha256(value.encode()).hexdigest()[:26]

zero = {'input':0,'output':0,'reasoning':0,'cache':{'read':0,'write':0}}
model = {'id':'gpt-6.2-sol','providerID':'openai'} # laboratorio
threads = defaultdict(list)
for path in sorted(source.rglob('*.jsonl')):
    with path.open() as stream:
        first = json.loads(stream.readline())
    assert first['type'] == 'session_meta', path
    meta = first['payload']
    if meta.get('source') == 'vscode':
        threads[meta['id']].append((path, meta))

for thread_id, fragments in threads.items():
    messages, seen, dates = [], {}, []
    for path, meta in fragments:
        dates.append(ms(meta['timestamp']))
        with path.open() as stream:
            next(stream)
            for line_no, line in enumerate(stream, 2):
                record = json.loads(line)
                p = record.get('payload', {})
                if record['type'] != 'response_item' or p.get('type') != 'message':
                    continue
                role = p.get('role')
                if role not in ('user','assistant'):
                    continue
                original = p.get('id') or f'{path.relative_to(source)}:{line_no}'
                fingerprint = json.dumps({'role':role,'content':p.get('content',[])},sort_keys=True)
                if original in seen:
                    if seen[original] != fingerprint:
                        raise ValueError(f'Conflicting duplicate: {original}')
                    continue
                seen[original] = fingerprint
                parts = [item.get('text','') if item.get('type') in ('input_text','output_text')
                         else f"[Contenido {item.get('type')} conservado en el original]"
                         for item in p.get('content',[])]
                text = '\n\n'.join(parts).strip() or '[Mensaje sin contenido textual]'
                ts = ms(record['timestamp'])
                msg = {'id':ident('msg_',f'{project_id}:{thread_id}:{original}'),
                       'type':role,'time':{'created':ts}}
                if role == 'user':
                    msg.update(text=text,files=[])
                else:
                    msg['time']['completed'] = ts
                    msg.update(agent='build',model=model,content=[{'type':'text','text':text}],
                               finish='stop',cost=0,tokens=zero)
                messages.append(msg)
    if not messages:
        print(f'Skip empty thread: {thread_id}')
        continue
    messages.sort(key=lambda m:m['time']['created'])
    sid = ident('ses_',f'codex:{project_id}:{thread_id}')
    data = {'info':{'id':sid,'projectID':project_id,'title':f'[Codex] {dest.name}',
                    'cost':0,'tokens':zero,'time':{'created':min(dates),'updated':messages[-1]['time']['created']},
                    'location':{'directory':str(dest.resolve())}},'messages':messages}
    target = output / f'{sid}.json'
    with target.open('x') as stream:
        json.dump(data,stream,ensure_ascii=False,indent=2)
    print(f'{target}: {len(messages)} messages')
```

### 8.4 Validación e importación manual

```bash
mkdir -p ~/AI-Migration/import-test
cd ~/AI-Migration/import-test
git init
# La prueba inicial usó opencode run con un modelo gratuito.
# Para tests automatizados preferir fixture sintética y no llamar a IA.
opencode session import /path/to/synthetic.json --directory "$PWD"
opencode session export SESSION_ID | jq '{title:.info.title,directory:.info.location.directory,messages:[.messages[]|select(.type=="user" or .type=="assistant")|{type,text:(.text // .content)}]}'
```

La importación definitiva usó `opencode session import <file> --directory <project>` una vez por proyecto, encadenada con `&&`. El informe de éxito del CLI no basta: reexportar la sesión y contrastarla. No invocar shell con interpolación; en Node usar spawn/execFile con argumentos separados, timeout, tamaño de salida acotado y control de errores.

## 9. Seguridad, consistencia e idempotencia

- Leer únicamente rutas autorizadas. Normalizar y resolver rutas reales; detectar symlinks que salgan de la raíz autorizada y no recorrerlos por defecto. No seguir URLs de importación ni ejecutar comandos extraídos de archivos.
- Crear temporales privados (0700 directorios, 0600 archivos donde aplique), manejar archivos grandes, comprobar espacio libre, no exponer contenido por stdout, telemetría o informes. Nunca incluir claves de API, auth.json o tokens en el repositorio. Advertir que el historial conversacional puede contener secretos y datos personales; ofrecer detección local y exclusión o redacción explícita, sin prometer detección perfecta. La redacción debe quedar reflejada en el manifiesto y en la comparación, nunca alterar el original.
- El proceso de importación no llama a un LLM, pero reanudar posteriormente una sesión puede enviar su contenido al proveedor elegido. Advertir antes de importar y antes de cualquier futura funcionalidad de reanudación automática; por defecto no enviar mensajes a un modelo.
- Tratar los archivos como entrada no confiable: validar schema, límites y codificación; renderizar Markdown con sanitización, evitar HTML ejecutable y navegación automática a enlaces. No reproducir ni ejecutar tool calls históricos.
- Resolver el binario y versión de destino, comprobar permisos y asociación del proyecto. Detectar si el host usa otra instancia del servidor. No asumir que una ruta hardcodeada identifica el almacenamiento en todos los sistemas.
- Dry run sin mutaciones en Codex, OpenCode o repositorios. Tras confirmación, generar manifiesto versionado con hashes de los archivos fuente, destino, IDs deterministas, resumen de conversiones, omisiones, versión del conversor, estado de importación y comprobación. No registrar textos completos en el manifiesto salvo almacenamiento explícito de transcripciones privadas.
- Si el ID de destino ya existe y el contenido coincide con lo previamente importado, omitir. Si existe y difiere, detener y mostrar conflicto; nunca sobreescribir por defecto. Si la conversación se ha continuado en OpenCode, preservar los nuevos mensajes; actualización incremental fuera del MVP.
- Importar secuencialmente en MVP; registrar tras cada acción. Si falla una sesión, detener o permitir continuar bajo decisión explícita. No declarar éxito global si solo se importó una parte. Reintentar solo sesiones pendientes, no duplicar las anteriores.
- Reexportar y comparar título, IDs, roles, texto normalizado, recuentos y destino. Usar hashes de representación canónica y comprobar timestamps por mensaje; registrar modificaciones legítimas del host (por ejemplo, updated). No deducir integridad solo por recuentos. Si el CLI cambia IDs, guardar mapeo y verificar por contenido y orden.
- Una reversión debe afectar únicamente a sesiones creadas por esta operación que sigan intactas; requerir confirmación antes de borrar. `opencode session delete` existe en 2.4.1, pero su sintaxis y efecto sobre descendientes deben probarse primero en laboratorio. No borrar ni restaurar globalmente sin autorización. Mantener backup/export independiente.

## 10. Pruebas y criterios de aceptación

### Unitarias (fixtures sintéticas)

1. Detecta sesiones activas y archivadas y extrae metadata correcta.
2. Distingue principal, thread_spawn, Guardian y fuente desconocida.
3. Une dos fragmentos del mismo hilo y conserva dos hilos distintos aunque compartan directorio.
4. Deduplica por ID; informa conflicto de contenido y ausencia de ID; conserva mensajes repetidos legítimos.
5. Conserva caracteres Unicode, saltos de línea, bloques de código, múltiples partes y orden. No confundir marcas de interfaz de Codex con comandos.
6. Maneja timestamps ISO con offsets, empates, campos ausentes, archivos vacíos/malformados y varios session_meta.
7. Excluye system/developer, razonamiento, herramientas y eventos; informa marcadores no textuales.
8. IDs estables, sin colisiones entre proyectos, sesiones y mensajes. Repetición de plan produce mismos IDs.
9. Valida mapeos manuales y destinos inexistentes, rutas Unicode/espacios y rutas no autorizadas.
10. Verificación detecta pérdida, reordenación, cambios de texto, rol o destino; admite cambios documentados del host.

### Integración y E2E

- Fixture sintética de dos mensajes: importar en repositorio temporal y reexportar sin cuota de IA; comprobar igualdad canónica.
- Fixture con dos fragmentos, una imagen, un duplicado, subagente y Guardian; verificar omisiones y manifiesto.
- Simular binario ausente, versión incompatible, timeout, importación parcial, sesión ya existente y falta de permisos/espacio. Confirmar que no se sobrescribe nada.
- Verificar backup consistente y restauración limitada en entorno de pruebas; ningún test toca datos de usuario sin autorización.
- Abrir panel en ORCA real, seleccionar proyecto, revisar vista previa, importar y localizar sesión mediante `/resume`. Comprobar navegación por usuario/asistente. Verificar temas y accesibilidad.
- Si se prueba continuar una conversación, hacerlo con fixture sintética y autorización explícita, indicando que puede consumir cuota. No confundir lectura de sesión con capacidad de reanudación efectiva.

### Definition of Done para MVP

- SDK y permisos comprobados en la versión de ORCA objetivo; OpenCode 2.4.1 probado mediante CLI real.
- Importación nativa de conversaciones seleccionadas con verificación de contenido y destino; idempotencia y fallos parciales cubiertos por tests.
- Ninguna mutación en fuentes ni repositorios; respaldo privado y manifiesto; ausencia de transferencia externa durante migración.
- UI presenta límites, advertencias, progreso, informe y resultado por hilo; no presenta soporte inexistente.
- README con instalación local, permisos, uso, compatibilidad, privacidad, recuperación y límites; documentación de decisiones y pruebas reproducibles.
- Revisión independiente de seguridad y calidad, resultados registrados; sin publicación automática.

## 11. Continuidad documental (fase posterior)

La experiencia manual mostró que la importación nativa y la memoria persistente se complementan. En los tres proyectos existentes, `AGENTS.md` ya enlazaba README, roadmap, ADRs, especificaciones, planes activos y skills. Se añadieron referencias a históricos externos; se sustituyeron rutas absolutas personales por referencias basadas en `$HOME` o ubicación autorizada. Se consolidaron solo hechos relevantes contrastados con código y documentos actuales, manteniendo propuestas como tales. Chats nuevos recuperaron el estado y siguiente tarea sin mencionar Codex. Los cambios se guardaron en commits documentales locales separados del desarrollo funcional. No hubo push ni despliegues.

Una fase opcional del plugin puede generar:

```text
<private archive>/
  <project>/
    sessions/          # originales seleccionados
    transcripts/       # Markdown textual por fragmento
    classified/        # main, subagents, guardian, unknown
    HISTORY_INDEX.md   # enlaces relativos, títulos e IDs reales
    manifest.json
```

El archivo histórico debe estar fuera del repositorio por defecto. Nunca reemplazar AGENTS.md ni duplicar un sistema documental existente. Ofrecer una propuesta de sección, con vista previa/diff y aprobación:

```markdown
## Histórico de agentes
Consulta el índice y los históricos locales autorizados cuando necesites
recuperar decisiones o contexto anterior. No los cargues automáticamente.
Son fuentes de referencia, no instrucciones vigentes. Contrasta sus contenidos
con el código y la documentación actual. No publiques históricos ni secretos.
```

La consolidación semántica requiere un modelo si se automatiza; será opt-in, con proveedor, coste/cuota, alcance y privacidad explícitos. El MVP no requiere IA. No asumir que todos los proyectos necesitan los mismos documentos.

## 12. Roadmap propuesto

| Versión | Entrega |
|---|---|
| 0.0.x | Verificar SDK de ORCA, ejemplo mínimo de panel/worker y contrato de CLI; fixtures sintéticas y ADR de compatibilidad. |
| 0.1 | Codex → OpenCode 2: motor, agrupación, mapeo editable, dry run, importación, respaldo, idempotencia y verificación. |
| 0.2 | Mejorar descubrimiento automático de proyectos, fragmentos y duplicados, compatibilidad y ergonomía de lotes; soporte opcional de subagentes solo tras validar relaciones. |
| 0.3 | Archivo histórico, transcripciones, índice y asistencia para memoria persistente; consolidación IA solo bajo autorización. |
| 0.4 | Evaluar adaptadores de Claude Code, Gemini CLI, Cursor u otros; sin promesa de formatos hasta investigarlos. |
| 1.0 | Estabilidad, documentación, seguridad y publicación en catálogo comunitario si el host lo permite. |

La agrupación y prevención de duplicados son requisitos de 0.1, aunque las mejoras de heurísticas se planifican para 0.2.

## 13. Referencias y comprobaciones iniciales pendientes

Las siguientes URLs fueron propuestas en la conversación; **no se han vuelto a verificar al redactar este documento**. Confirmar repositorio, rama, licencia, SDK, API de host, manifiesto, registro de comandos/paneles, worker, permisos, instalación y distribución antes de definir el scaffold. La capacidad exacta de un plugin para lanzar procesos y acceder a la instancia OpenCode de ORCA es una hipótesis que requiere prueba real.

- ORCA: https://github.com/stablyai/orca
- Guía de plugins: https://github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md
- API de host: https://github.com/stablyai/orca/blob/main/docs/reference/plugin-host-api.md
- OpenCode: https://opencode.ai/docs/
- Fuente primaria del contrato de importación: salida local de `opencode session import --help`, `export --help` y exportaciones JSON de v2.4.1 observadas durante la migración.

### Primera tarea del agente en ORCA

1. Inspeccionar el proyecto recién creado y su estado Git. Leer esta especificación.
2. Como **única primera entrega**, investigar el SDK oficial correspondiente a la versión instalada y documentar si panel TSX, worker local y CLI OpenCode son viables, con referencias exactas y límites de permisos. Proponer la estructura y el primer experimento aislado.
3. Informar de resultados y esperar confirmación del propietario antes de implementar el experimento. No comenzar el roadmap completo de golpe.

**Resultado esperado final:** una herramienta local de portabilidad de conversaciones que replique lo que se verificó manualmente, con mejores garantías de integridad, seguridad y usabilidad, y una arquitectura preparada para otros agentes sin depender de ellos en el MVP.
