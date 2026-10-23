# Mercadín web

Buscador que compara el precio de un producto en varios supermercados españoles a la vez. Es la versión web de la app Android Mercadín.

**Web:** https://neburman.github.io/mercadin-web/

> Los precios son orientativos: salen de la tienda online de cada comercio y pueden variar en la tienda física. Proyecto no afiliado a ningún comercio.

## Qué hace

- Busca un producto en 13 comercios a la vez: Aldi, Mercadona, Lidl, Dia, Carrefour, Consum, Alcampo, BM, Eroski, El Corte Inglés, Costco (vía Uber Eats), Action y Amazon (Alimentación y bebidas).
- Calcula el precio por kilo, litro o unidad para poder comparar envases distintos.
- Ordena por precio por kg/l (el orden inicial), relevancia, más barato, más caro, ofertas o A-Z.
- Solo muestra productos cuyo nombre o marca contienen lo buscado, sin tener en cuenta tildes ni plurales.
- Guarda productos en una lista de la compra separada por comercio, con cantidades, subtotales y casillas para marcar lo ya comprado y quitarlo.
- Recuerda en el navegador el código postal, los comercios elegidos, la última ordenación y la lista de la compra.
- Muestra los resultados según responde cada comercio, sin esperar al más lento; un comercio que tarda más de 10 s se da por caído.
- Pinta los resultados por bloques al hacer scroll, para gastar menos datos.
- Guarda cada búsqueda 10 minutos: repetirla o cambiar los comercios marcados no vuelve a pedir lo ya recibido.

## Cómo usarlo en local

No hay que compilar ni instalar nada: basta con abrir `index.html` con doble clic.

Si se prefiere servirlo como en GitHub Pages:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

y abrir http://127.0.0.1:8080/.

## Estructura

```
index.html          Única página: carga los CSS y los <script defer> en orden de dependencia
css/
  tokens.css        Variables: colores, espaciados, tipografía, tamaños
  base.css          Reset, cabecera, controles y botones comunes
  components/       Un CSS por componente
js/
  core/             Motor y componentes de la interfaz
  stores/           Un adaptador por comercio
img/                Logo y favicon
```

### `js/core`

| Archivo | Responsabilidad |
|---|---|
| `app.js` | Punto de entrada: registra los comercios e inicia los componentes |
| `engine.js` | Consulta en paralelo los comercios elegidos, descarta lo que no tiene relación con la búsqueda y normaliza los productos |
| `product.js` | Modelo común de producto: validación y cálculo del precio por unidad |
| `utils.js` | HTTP, proxy, almacenamiento, comparación de texto, formato, escape y eventos |
| `algolia.js` / `aktios.js` | Lógica común de las plataformas que comparten varios comercios |
| `search.js` | Formulario de búsqueda (solo busca al pulsar «Buscar») |
| `results.js` | Estados, comercios que aún cargan o no responden y rejilla de productos con carga por scroll |
| `sort.js` | Opciones de ordenación |
| `store-filter.js` | Selección de comercios |
| `dropdown.js` | Desplegables de comercios y ordenación: lista cerrada en móvil y tablet, chips abiertos en PC |
| `postal-code.js` | Código postal |
| `cart.js` | Lista de la compra: botón con contador en la cabecera y modal con los productos agrupados por comercio |

Cada componente es un objeto literal global con `constants`, `globals`, `elements`, `init()` y `listeners()`. No se usan módulos ES para que la página funcione abierta desde `file://`.

## Proxy

La mayoría de comercios no permiten peticiones desde otras webs (CORS). Esas peticiones pasan por un Cloudflare Worker (`utils.constants.PROXY_URL`), cuyo código está en [`proxy/worker.js`](proxy/worker.js) con los pasos para desplegarlo en otra cuenta. El Worker:

- solo reenvía a los dominios de su lista `ALLOWED_HOSTS` y solo acepta los orígenes de `ALLOWED_ORIGINS` (GitHub Pages, `file://` y localhost);
- no reenvía cookies ni cabeceras de origen, y no sigue redirecciones;
- devuelve las respuestas comprimidas.

Aldi y Mercadona van directos, sin proxy: su buscador ya permite peticiones desde otras webs y responde comprimido. Lidl también las permite, pero va por el proxy porque responde sin comprimir.

## Añadir un comercio

1. Crear `js/stores/<comercio>.js` con el contrato de adaptador:
   - `constants`: `ID`, `NAME`, `LOGO_URL`, `MODE`, endpoint y parámetros;
   - `isAvailable(postalCode)`: si el comercio da servicio en ese código postal;
   - `search(term, signal)`: lanza la petición y devuelve la respuesta cruda (con `utils.requestJson` si va directo, o `utils.requestProxiedJson` si va por el proxy);
   - `toProducts(raw)`: mapea la respuesta a los campos del modelo común (`id`, `name`, `brand`, `imageUrl`, `price`, `previousPrice`, `unitPrice`/`unitScale` o `packageText`, `available`, `categories`).
2. Añadir su `<script defer>` en `index.html`, antes de los componentes de `js/core`.
3. Añadirlo a `STORES` en `js/core/app.js`.
4. Si va por proxy, añadir su dominio a `ALLOWED_HOSTS` del Worker.

Si una escala de unidad no se reconoce, el producto se descarta y se avisa en consola; se añade la escala a `UNIT_SCALES` en `product.js`.

## Puntos frágiles

- **Action** recibe una consulta GraphQL propia escrita en `js/stores/action.js`: si Action cambia los nombres de sus campos, hay que ajustarla.
- **Eroski** no tiene API JSON: se lee el HTML de su listado, así que depende de sus clases CSS.
- **Costco** muestra los precios de su tienda en Uber Eats, no los de la tienda física.
- **Amazon** tampoco tiene API: se lee el HTML de su página de resultados (depende de sus atributos `data-cy` y clases `a-price`) y puede pedir captcha si detecta demasiadas peticiones desde el proxy.

## Licencia

[MIT](LICENSE)
