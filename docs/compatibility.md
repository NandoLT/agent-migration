# Compatibilidad inicial — Agent Migration

**Alcance:** primera entrega de la sección 13 de `AGENT_MIGRATION_SPEC.md`. Inspección local y contraste con fuentes oficiales; sin implementar ni ejecutar el experimento.

## Entorno comprobado

- La carpeta de trabajo `Agent_migration_orca_plugin` solo contenía la especificación. `git status --short --branch` confirmó que no es un repositorio. El destino previsto `~/Projects/agent-migration` no existe en este equipo. No se ha inicializado Git ni se ha movido nada.
- `orca --version` devuelve **1.4.273**. Se ha consultado el [tag oficial `v1.4.273`](https://github.com/stablyai/orca/releases/tag/v1.4.273), que apunta al commit [`7027c7e`](https://github.com/stablyai/orca/commit/7027c7ecce594d2295c47e9afc9004b1eb6c83bb), no la rama de desarrollo `main`. [Orca usa licencia MIT](https://github.com/stablyai/orca/blob/v1.4.273/LICENSE); la licencia de Agent Migration sigue pendiente de aprobación.
- `opencode --version` devuelve **2.4.1** en la terminal actual, con un binario resuelto mediante mise. El gestor del sistema registra además `opencode 2.1.2-1`. No se ha comprobado qué binario resolvería el worker ni cuál usa Orca al abrir una sesión.

## Qué permite el SDK de Orca 1.4.273

| Superficie | Viabilidad y límites |
| --- | --- |
| Panel TSX | **Soportado por el SDK.** El [ejemplo oficial `hello-worker-panel`](https://github.com/stablyai/orca/tree/v1.4.273/examples/plugins/hello-worker-panel) declara `contributes.panels` con `ui: "components"` y una entrada `.tsx`. Orca transpila desde 1.4.246 y dibuja controles propios; no hace falta introducir React ni un bundler para el experimento. El panel no tiene acceso directo a Node ni al sistema de archivos; el [frame de escritorio](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#files-and-assets) tampoco tiene acceso directo a la red. |
| Worker local | **Soportado por el SDK.** El [manifiesto v2](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-manifest.md) permite `main` como módulo Node separado, también `.ts` sin compilación previa desde 1.4.246, con perfil `trusted-worker` y aprobación explícita. El panel usa [`plugin.request`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-host-api.md#pluginrequest) y el worker registra el receptor con `orca.panels.handle`. No se requiere una capacidad adicional del host para este puente. |
| Ejecutar el CLI desde el worker | **Viable por diseño; pendiente de prueba en Orca.** La [guía](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#frames-windoworca) documenta que los módulos `node:` se resuelven como en Node y que el worker no está aislado del sistema. La vía propuesta es `node:child_process` con ejecutable absoluto validado, argumentos separados, sin shell, con cancelación, tiempo y salida acotados. No usar `terminal.create` ni `terminal.sendText` como puente. |

### Límites de confianza

- La aprobación de `trusted-worker` concede acceso al sistema con los permisos de la cuenta, incluso con `capabilities: []`. Orca comprueba esas capacidades en las **llamadas al host**, no en las operaciones directas de Node. Las restricciones de rutas, procesos y red del producto no vendrán impuestas por ese manifiesto. El [filtro de entorno de esta versión](https://github.com/stablyai/orca/blob/v1.4.273/src/main/plugins/workers/parent-process/plugin-worker-env.ts) conserva `PATH` y `HOME` si estaban presentes, pero no incluye `CODEX_HOME`, `OPENCODE_DB` ni `XDG_CONFIG_HOME`, `XDG_DATA_HOME` o `XDG_STATE_HOME`. No asumir que el entorno sea el de la terminal interactiva.
- La [API 1.10 del host](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-host-api.md) no documenta una API de importación ni un método para identificar el servicio OpenCode que utiliza Orca. `agent.listSessions` requiere `history:read` y solo da metadatos; no da transcripciones ni rutas. `project.list` requiere `workspace:read`: podría servir más adelante para ofrecer destinos locales, pero su ID no acredita el `projectID` de OpenCode. Ninguna de estas capacidades es necesaria para el experimento.
- El [puente panel–worker](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#panels-workers-and-data) acepta JSON con hasta 64 KiB de entrada y 1 MiB de respuesta; el tiempo de espera es 30 s por defecto y 120 s como máximo. No diseñar el flujo para pasar transcripciones completas por él ni para hacer una migración larga en una sola petición.

### Contrato del CLI observado

En **OpenCode 2.4.1**, `opencode session import --help` confirma `opencode session import <file> --directory <directorio>` y admite también URL, que el producto no usará. `opencode session export --help` confirma la exportación por ID a JSON y `--sanitize`, que no sirve para verificar el texto exacto. Ambas ayudas muestran `--standalone` y `--server`. La [guía oficial de CLI](https://opencode.ai/docs/cli#background-service) explica que por defecto el cliente descubre o inicia el servicio compartido, y que esos flags cambian la conexión. Un servidor privado no demuestra por sí solo que el almacenamiento sea independiente.

Se ha comprobado la sintaxis, **no** una importación o reexportación en este paso. Tampoco se ha probado la correspondencia entre el servicio o almacenamiento del CLI y el historial visible en Orca. Si no se puede acreditar el destino, no se debe importar.

## Estructura propuesta, todavía sin crear

- `orca-plugin.json`: manifiesto v2, `pluginApi: 1`, `trusted-worker`, un panel `components` y ninguna capacidad del host para la prueba. `engines.orca: ">=1.4.246"` cubre las funciones base elegidas según el SDK; la primera validación se limitaría a 1.4.273.
- `src/ui/panel.tsx`, `src/worker/main.ts` y `src/protocol.ts`: panel, punto de entrada Node y contrato compartido. Sin dependencias de UI ni paso de compilación inicial.
- `tests/fixtures/` para datos exclusivamente sintéticos. Separar `src/core/`, `src/adapters/` e `src/infrastructure/` cuando haya una función real que lo justifique.

La [guía del tag](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#2-load-it-while-you-work) documenta `orca plugin validate`, `dev load`/`dev watch`, `open` y `dev request`; el CLI instalado anuncia esos comandos. La carga local y su aprobación se reservan para el experimento. [La distribución](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#5-publish-to-a-catalog) admite catálogos Git con commit y hash fijados, pero no forma parte de esta entrega.

## Primer experimento aislado — pendiente de aprobación

Un botón «Comprobar entorno» en un panel Orca real llamaría al worker. Este leería únicamente un fichero sintético en un directorio temporal privado y ejecutaría solo `opencode --version` con un binario local explícito y verificado. El panel mostraría el estado de la lectura y la versión, o un error controlado si el binario no está disponible. No aceptaría del panel rutas ni comandos arbitrarios. La prueba se daría por válida al ver en Orca el resultado del worker y comprobar un fallo controlado, sin mostrar contenido del fichero ni rutas personales.

Sin leer históricos reales, tocar el almacén OpenCode, iniciar su servicio, llamar a modelos ni modificar Orca. La importación y reexportación de dos mensajes sintéticos quedarían para un paso posterior: primero habría que acreditar el aislamiento del servicio y su almacenamiento, y después comparar IDs, roles, texto y destino.
