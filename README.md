# Agent Migration

**Session portability for Orca.**

Proyecto para importar conversaciones locales de OpenAI Codex a OpenCode 2 desde Orca, preservando los originales y verificando lo importado.

**Estado:** inventario de Codex de solo lectura en Linux. Todavía no importa sesiones ni comprueba duplicados en OpenCode.

- [Especificación pública](docs/specification.md): requisitos, arquitectura propuesta y referencia de la migración manual con nombres y rutas anonimizados.
- [Nota de compatibilidad](docs/compatibility.md): resultados en Orca 1.4.273 y OpenCode 2.4.1 y límites de permisos.
- [Prueba del renderizador HTML](docs/html-renderer-spike.md): capacidades del frame, límites de anchura y capturas.

## Probar el prototipo en Orca

Genera el bundle local de React y TypeScript desde la raíz. Repite `npm run build:ui` al cambiar el TSX; el HTML y el CSS se sirven directamente desde `plugin/ui/`.

```sh
npm ci --ignore-scripts
npm run build:ui
```

Añade **solo `plugin/`** como carpeta de desarrollo en **Settings → Plugins**, revisa y aprueba `trusted-worker` explícitamente, y abre **Agent Migration**. Aunque no pide capacidades adicionales a la API de Orca, el perfil `trusted-worker` ejecuta código con los permisos de la cuenta.

**Scan** lee `sessions/`, `archived_sessions/` y el índice de títulos `session_index.jsonl` de Codex. Usa `CODEX_HOME` si llega al worker o `~/.codex` por defecto. Si Orca no hereda ese override, indica la ruta absoluta en **Scan location**. La lectura no sigue enlaces simbólicos dentro del árbol. El panel recibe títulos, fechas, rutas de origen y recuentos, sin transcripciones. Las rutas de origen no se usan como destinos.

Los resultados reales se agrupan por directorio de origen y muestran el tipo de sesión, los fragmentos archivados y las incidencias de lectura. El límite es de 250 hilos mostrados, 12.000 entradas de directorio, 2 GiB leídos, 200.000 IDs de mensaje y 12 niveles de carpetas. Las líneas que superan 1 MiB se omiten y el hilo se marca como incompleto. La asignación de destino y el estado **Already imported** todavía no se calculan para resultados reales.

**Show demo** mantiene disponible la maqueta ficticia de Aurora, Faro y Atlas para probar selección, asignación y vista previa. **Import selected projects** sigue deshabilitado en ambos modos.

## Validación local

Desde la raíz del repositorio:

```sh
orca plugin validate ./plugin
orca plugin check ./plugin
orca plugin test ./plugin
node tests/integration/html-panel.cjs  # requires Chromium
```

`check` y `test` ejecutan código local fuera del aislamiento de Orca. No activan el plugin en el escritorio. La prueba de Chromium abre el bundle generado en un perfil temporal y comprueba los selectores, el flujo de selección y el layout a 320, 400, 600, 900 y 1200 px, con CSS claro y oscuro.

La maqueta no necesita OpenCode. Para probar el worker técnico o ejecutar el ensayo aislado del CLI en Linux, fija un ejecutable nativo de OpenCode **2.4.1** de procedencia conocida en `plugin/.orca/opencode-pin.json` (fichero local ignorado por Git):

```json
{ "path": "/ruta/canónica/al/ejecutable-nativo", "sha256": "<64 caracteres hexadecimales>" }
```

Usa `realpath` y `sha256sum` sobre el ejecutable verificado, no sobre su lanzador o enlace. El worker comprueba la ruta canónica, la cabecera ELF y el SHA-256 antes de lanzar el proceso. Si falta el fichero o no coincide lo registrado, no ejecuta nada ni busca alternativas en `PATH`.

Con `plugin/` cargado como carpeta de desarrollo, la comprobación técnica se puede ejecutar con `orca plugin dev request ./plugin environment.check --data '{}' --environment local`.

## Prueba aislada del CLI

En Linux con Bubblewrap, espacios de nombres de usuario habilitados, Bash, Git y `jq`, se puede importar y reexportar una sesión sintética sin usar el almacén real de OpenCode. Usa el mismo fichero local del ejecutable fijado:

```sh
pin=plugin/.orca/opencode-pin.json
bash tests/integration/opencode-roundtrip.sh "$(jq -er '.path' "$pin")" "$(jq -er '.sha256' "$pin")"
```

El script comprueba el aislamiento antes de importar. No ejecuta el plugin de Orca ni llama a ningún modelo.
