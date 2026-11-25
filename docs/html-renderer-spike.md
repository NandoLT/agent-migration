# Prueba de concepto: panel HTML en Orca 1.4.273

**Resultado:** `ui: "html"` es viable para el rediseño en el escritorio. La prueba es un panel desechable con `sandboxed-ui`, sin `main`, sin capacidades de host y con datos ficticios. No sustituye la UI actual ni toca el worker, los contratos, el almacenamiento, las sesiones o el código de Orca.

## Capacidades y límites

| Capacidad | Evidencia |
| --- | --- |
| HTML, CSS, SVG | Probados en el frame real de Orca: hoja CSS propia, icono SVG local, controles HTML y pie fijo fuera de la zona desplazable. Las consultas `@container` cambiaron el layout según el ancho del **frame**. |
| React | React y ReactDOM **18.3.1** renderizaron desde archivos locales. Orca no inyecta React ni resuelve imports npm desnudos. Para el rediseño se recomienda generar un bundle local de React + TSX; no usar CDN ni dejar el runtime UMD de la prueba como arquitectura de producto. |
| TypeScript | `panel.ts` se transpila en el frame real sin paso de build. Esto no hace comprobación estática de tipos. El [transpilador de este tag](https://github.com/stablyai/orca/blob/v1.4.273/src/main/plugins/source-loading/plugin-source-sucrase-transform.ts) usa `orca` como runtime JSX predeterminado; la prueba usa `React.createElement` y no presume que los imports habituales de React/JSX funcionen sin empaquetar. |
| Temas | El frame expone [variables `--orca-*`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-theme-tokens.md#frame-css-variables) y cambia `light`/`dark` en el documento. La prueba usa esos tokens y se verificó en oscuro. Claro no se verificó visualmente: con la ventana visible, `shot --theme light` mantuvo el tema actual e indicó por qué. |
| Aislamiento y puente | El [frame de escritorio](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#files-and-assets) carga activos locales y no tiene acceso directo a red, Node ni al sistema de archivos. El producto puede seguir usando [`window.orca.plugin.request`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-authoring.md#panels-workers-and-data) hacia **su propio** worker, sin añadir capacidades al manifiesto. La prueba no invoca ese puente. El worker existente conserva su perfil `trusted-worker`; cambiar el renderizador no amplía ni restringe los permisos del proceso worker. |
| Ubicación | [`contributes.panels`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-manifest.md#panelcontribution) y `orca plugin open --panel` abren la barra derecha. El [límite de anchura del host](https://github.com/stablyai/orca/blob/v1.4.273/src/renderer/src/components/right-sidebar/layout/right-sidebar-width.ts) depende del espacio de la ventana. No hay una API pública documentada para expandir el panel sin límite, moverlo al centro o abrirlo a pantalla completa. |
| Editor central | [`contributes.editors`](https://github.com/stablyai/orca/blob/v1.4.273/docs/reference/plugin-manifest.md#editorcontribution) y `orca plugin open --editor <file>` permiten una pestaña central **asociada a un documento**. Es una superficie distinta, con ciclo de vida y acceso al documento abierto; no es un modo de expansión del panel. Sería razonable solo si más adelante existe un fichero de plan o informe que realmente se quiera abrir. No se añadió un editor ni se usó el archivo de dibujo local. |

## Capturas del renderizador real

Se usó `orca plugin shot <plugin-key> --width <px>` en el escritorio con Orca **1.4.273**. Las cinco capturas se asentaron sin errores registrados; no mostraron desbordamiento horizontal en esta maqueta.

| Ancho solicitado | Ancho capturado | Layout observado |
| ---: | ---: | --- |
| 320 | 320 | Compacto |
| 400 | 400 | Compacto |
| 600 | 600 | Columna única |
| 900 | 900 | Dashboard |
| 1200 | 959 | Dashboard; Orca limitó el ancho en esta ventana |

`shot --act` no admite paneles HTML. Las capturas prueban el renderizado, no la navegación por teclado ni la interacción. Estas comprobaciones y el tema claro quedan pendientes para el rediseño, al igual que una captura de 1200 px reales en una ventana que lo permita.

## Reproducción

Desde la raíz, prepara fuera del repositorio el [panel de prueba](../experiments/html-renderer/). `npm pack` descarga solo los paquetes fijados a 18.3.1, sin instalar herramientas ni ejecutar sus scripts. Orca solo recibe la carpeta `panel`; los paquetes descargados y las capturas quedan fuera de ella.

```bash
work=$(mktemp -d)
mkdir -p "$work/panel/vendor" "$work/shots"
cp experiments/html-renderer/{orca-plugin.json,index.html,icon.svg,panel.ts,panel.css} "$work/panel/"
npm pack react@18.3.1 react-dom@18.3.1 --ignore-scripts --pack-destination "$work"
tar -xOf "$work/react-18.3.1.tgz" package/umd/react.production.min.js > "$work/panel/vendor/react.js"
tar -xOf "$work/react-dom-18.3.1.tgz" package/umd/react-dom.production.min.js > "$work/panel/vendor/react-dom.js"
orca plugin validate "$work/panel"
orca plugin dev load "$work/panel" --environment local
```

Revisa y aprueba únicamente ese panel aislado. Después:

```bash
for width in 320 400 600 900 1200; do
  orca plugin shot local.agent-migration-html-poc --environment local \
    --width "$width" --out "$work/shots/width-$width.png" --json
done
orca plugin dev unload "$work/panel" --environment local
```

## Propuesta para el rediseño, pendiente de aprobación

Cambiar solo el punto de entrada del panel de Agent Migration a HTML y empaquetar React + TypeScript con CSS y SVG locales. Usar los SVG de referencia para la densidad y la composición —no como activos ejecutables—: cabecera y flujo origen/destino compactos, grupos y asignación de destino, opciones plegables o en segunda columna, y acciones fuera del área desplazable. Mantener los puntos de corte de 420 y 760 px medidos en el contenedor. Conservar selección por hilo, estados de bloqueo, reasignación y totales; migrar las pruebas de interacción de la presentación y mantener las del worker sin cambios. No añadir acción de expansión ni habilitar la importación durante la fase de UI con datos ficticios.
