# Compatibilidad inicial — Agent Migration

**Alcance:** comprobaciones iniciales de la [sección 13 de la especificación](specification.md#13-referencias-y-comprobaciones-iniciales-pendientes): revisión del SDK, prueba del panel con un worker y ensayo del CLI en un entorno aislado.

## Entorno comprobado

- En la inspección inicial, la carpeta de trabajo solo contenía la especificación y no tenía Git. El repositorio se inicializó después en esa misma carpeta.
- `orca --version` devuelve **1.4.273**. Se ha consultado el [tag oficial `v1.4.273`](https://github.com/stablyai/orca/releases/tag/v1.4.273), que apunta al commit [`7027c7e`](https://github.com/stablyai/orca/commit/7027c7ecce594d2295c47e9afc9004b1eb6c83bb), no la rama de desarrollo `main`. [Orca usa licencia MIT](https://github.com/stablyai/orca/blob/v1.4.273/LICENSE); la licencia de Agent Migration sigue pendiente de aprobación.
- `opencode --version` devuelve **2.4.1** en la terminal actual, con un binario resuelto mediante mise. El gestor del sistema registra además `opencode 2.1.2-1`. El worker utiliza el ejecutable fijado de 2.4.1, no el que resuelva `PATH`. No se ha comprobado qué CLI o instancia usa Orca al abrir una sesión.

## Qué permite el SDK de Orca 1.4.273

| Superficie | Viabilidad y límites |
| --- | --- |
| Panel TSX | **Soportado por el SDK.** El [ejemplo oficial `hello-worker-panel`](https://github.com/stablyai/orca/tree/v1.4.273/examples/plugins/hello-worker-panel) declara `contributes.panels` con `ui: "components"` y una entrada `.tsx`. Orca transpila desde 1.4.246 y dibuja controles propios; no hace falta introducir React ni un bundler para el experimento. El panel no tiene acceso directo a Node ni al sistema de archivos; el [frame de escritorio](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#files-and-assets) tampoco tiene acceso directo a la red. |
| Worker local | **Soportado por el SDK.** El [manifiesto v2](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-manifest.md) permite `main` como módulo Node separado, también `.ts` sin compilación previa desde 1.4.246, con perfil `trusted-worker` y aprobación explícita. El panel usa [`plugin.request`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-host-api.md#pluginrequest) y el worker registra el receptor con `orca.panels.handle`. No se requiere una capacidad adicional del host para este puente. |
| Ejecutar el CLI desde el worker | **Probado en Orca para `--version`.** La [guía](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#frames-windoworca) documenta que los módulos `node:` se resuelven como en Node y que el worker no está aislado del sistema. La prueba usa `node:child_process` con ejecutable absoluto validado, argumentos separados, sin shell, con cancelación, tiempo y salida acotados. No usa `terminal.create` ni `terminal.sendText`. |

### Límites de confianza

- La aprobación de `trusted-worker` concede acceso al sistema con los permisos de la cuenta, incluso con `capabilities: []`. Orca comprueba esas capacidades en las **llamadas al host**, no en las operaciones directas de Node. Las restricciones de rutas, procesos y red del producto no vendrán impuestas por ese manifiesto. El [filtro de entorno de esta versión](https://github.com/stablyai/orca/blob/v1.4.273/src/main/plugins/workers/parent-process/plugin-worker-env.ts) conserva `PATH` y `HOME` si estaban presentes, pero no incluye `CODEX_HOME`, `OPENCODE_DB` ni `XDG_CONFIG_HOME`, `XDG_DATA_HOME` o `XDG_STATE_HOME`. No asumir que el entorno sea el de la terminal interactiva.
- La [API 1.10 del host](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-host-api.md) no documenta una API de importación ni un método para identificar el servicio OpenCode que utiliza Orca. `agent.listSessions` requiere `history:read` y solo da metadatos; no da transcripciones ni rutas. `project.list` requiere `workspace:read`: podría servir más adelante para ofrecer destinos locales, pero su ID no acredita el `projectID` de OpenCode. Ninguna de estas capacidades es necesaria para el experimento.
- El [puente panel–worker](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#panels-workers-and-data) acepta JSON con hasta 64 KiB de entrada y 1 MiB de respuesta; el tiempo de espera es 30 s por defecto y 120 s como máximo. No diseñar el flujo para pasar transcripciones completas por él ni para hacer una migración larga en una sola petición.

### Contrato del CLI observado

En **OpenCode 2.4.1**, `opencode session import --help` confirma `opencode session import <file> --directory <directorio>` y admite también URL, que el producto no usará. `opencode session export --help` confirma la exportación por ID a JSON y `--sanitize`, que no sirve para verificar el texto exacto. Ambas ayudas muestran `--standalone` y `--server`. La [guía oficial de CLI](https://opencode.ai/docs/cli#background-service) explica que por defecto el cliente descubre o inicia el servicio compartido, y que esos flags cambian la conexión. Un servidor privado no demuestra por sí solo que el almacenamiento sea independiente.

La importación y reexportación se han probado con una sesión sintética en almacenamiento aislado (véase más abajo). No se ha probado la correspondencia entre el servicio o almacenamiento del CLI y el historial visible en Orca. Si no se puede acreditar el destino, no se debe importar.

## Estructura del experimento

- `plugin/orca-plugin.json`: manifiesto v2, `pluginApi: 1`, `trusted-worker`, un panel `components` y ninguna capacidad del host para la prueba. `engines.orca: ">=1.4.246"` cubre las funciones base elegidas según el SDK; la ejecución real se ha validado en 1.4.273.
- `plugin/src/`: panel, punto de entrada Node y contrato compartido. Sin dependencias de UI ni paso de compilación inicial.
- `tests/fixtures/` para datos exclusivamente sintéticos. Separar `src/core/`, `src/adapters/` e `src/infrastructure/` cuando haya una función real que lo justifique.

La [guía del tag](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#2-load-it-while-you-work) documenta `orca plugin validate`, `dev load`/`dev watch`, `open` y `dev request`. [La distribución](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#5-publish-to-a-catalog) admite catálogos Git con commit y hash fijados, pero no forma parte de esta entrega.

## Primer experimento aislado — superado en Orca 1.4.273

El botón **Check environment** de un panel Orca real llamó al worker. Este comprobó un fichero sintético temporal y ejecutó únicamente `opencode --version` con el ejecutable nativo fijado por ruta canónica y SHA-256. El propietario confirmó que el panel mostró **Synthetic file verified.** y **OpenCode 2.4.1 detected**. Las pruebas locales cubrieron el rechazo sin huella configurada o con una huella incorrecta, sin lanzar otro ejecutable.

La prueba del panel no leyó históricos reales, no tocó el almacén de OpenCode, no inició su servicio ni llamó a modelos. Orca solo registró y aprobó la carpeta de desarrollo.

## Importación y reexportación sintéticas — superado en OpenCode 2.4.1

El [script de integración](../tests/integration/opencode-roundtrip.sh) ejecutó el binario fijado en un contenedor Bubblewrap sin acceso a la carpeta personal ni al directorio de ejecución del anfitrión, con solo loopback y sin entorno heredado. Antes de importar, `opencode debug paths db` confirmó que la base aún no existía y que su ruta era `/lab/data/opencode-test.db`. Solo se montaron las dependencias del sistema, el binario y la fixture en modo lectura, y un directorio temporal privado para el proyecto Git y el almacenamiento OpenCode. Se usó `--standalone` en ambas operaciones.

- Se importó una sola sesión con dos mensajes y se reexportó por su ID, sin `--sanitize`. Coincidieron el ID y el título de la sesión, la fecha de creación, y los IDs, roles, orden, texto y marcas de tiempo de ambos mensajes. El texto incluía Unicode, saltos de línea y un bloque de código. El modelo de la [fixture](../tests/fixtures/opencode-v2-two-messages.json) es un metadato de compatibilidad; no hubo inferencia.
- `--directory` sustituyó el directorio y el `projectID` de origen por los del destino. El `projectID` reexportado coincidió con el commit raíz del Git temporal y el repositorio quedó limpio.
- `info.time.updated` cambió de `1795292949000` a `1795636996348` en el primer ensayo. La prueba registra ese cambio sin tratarlo como pérdida del contenido.

Esto valida el contrato del CLI aislado, no la importación desde el panel, la visibilidad en el historial de Orca ni la idempotencia.
