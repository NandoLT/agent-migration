# Agent Migration

**Session portability for Orca.**

Proyecto para importar conversaciones locales de OpenAI Codex a OpenCode 2 desde Orca, preservando los originales y verificando lo importado.

**Estado:** prueba de compatibilidad en desarrollo. El panel experimental no importa sesiones.

- [Especificación pública](docs/specification.md): requisitos, arquitectura propuesta y referencia de la migración manual con nombres y rutas anonimizados.
- [Nota de compatibilidad](docs/compatibility.md): resultados en Orca 1.4.273 y OpenCode 2.4.1, límites de permisos y primer experimento propuesto.

## Prueba local de compatibilidad

Desde la raíz del repositorio:

```sh
orca plugin validate ./plugin
orca plugin check ./plugin
orca plugin test ./plugin
```

`check` y `test` ejecutan código local fuera del aislamiento de Orca. No activan el plugin en el escritorio. Para probarlo allí, añade **solo `plugin/`** como carpeta de desarrollo en **Settings → Plugins**, revisa y aprueba `trusted-worker` explícitamente, y abre el panel **Agent Migration**. Con **Check environment**, el worker comprueba un fichero sintético temporal y ejecuta solo `opencode --version`; no lee históricos ni importa sesiones. Aunque no pide capacidades adicionales a la API de Orca, el perfil `trusted-worker` ejecuta código con los permisos de la cuenta.

Antes de probarlo en Linux, fija un ejecutable nativo de OpenCode **2.4.1** de procedencia conocida en `plugin/.orca/opencode-pin.json` (fichero local ignorado por Git):

```json
{ "path": "/ruta/canónica/al/ejecutable-nativo", "sha256": "<64 caracteres hexadecimales>" }
```

Usa `realpath` y `sha256sum` sobre el ejecutable verificado, no sobre su lanzador o enlace. El worker comprueba la ruta canónica, la cabecera ELF y el SHA-256 antes de lanzar el proceso. Si falta el fichero o no coincide lo registrado, no ejecuta nada ni busca alternativas en `PATH`.

## Prueba aislada del CLI

En Linux con Bubblewrap, espacios de nombres de usuario habilitados, Bash, Git y `jq`, se puede importar y reexportar una sesión sintética sin usar el almacén real de OpenCode. Usa el mismo fichero local del ejecutable fijado:

```sh
pin=plugin/.orca/opencode-pin.json
bash tests/integration/opencode-roundtrip.sh "$(jq -er '.path' "$pin")" "$(jq -er '.sha256' "$pin")"
```

El script comprueba el aislamiento antes de importar. No ejecuta el plugin de Orca ni llama a ningún modelo.
