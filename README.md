# Mercadín web

Buscador que compara el precio de un producto en varios supermercados españoles a la vez. Es la versión web de la app Android Mercadín.

**Web:** https://neburman.github.io/mercadin-web/

> Los precios son orientativos: salen de la tienda online de cada comercio y pueden variar en la tienda física. Proyecto no afiliado a ningún comercio.

## Qué hace

- Busca un producto en 19 comercios a la vez: Aldi, Mercadona, Lidl, Dia, Carrefour, Consum, Alcampo, BM, Eroski, El Corte Inglés, Costco (vía Uber Eats), Action, Amazon (primero en Alimentación y bebidas; si ahí no hay nada, en todos los departamentos), Lupa (con un código postal, solo si reparte en él), las perfumerías Primor y Druni y las tiendas de mascotas Kiwoko, Tiendanimal y Zooplus.
- Con código postal, el selector de comercios oculta los que no dan servicio en esa zona.
- El selector de comercios tiene un buscador por nombre, sin tener en cuenta tildes ni mayúsculas.
- Calcula el precio por kilo, litro o unidad para poder comparar envases distintos.
- Ordena por precio por kg/l (el orden inicial), relevancia, más barato, más caro, ofertas o A-Z.
- Solo muestra productos cuyo nombre o marca contienen lo buscado, sin tener en cuenta tildes ni plurales.
- Al pulsar un producto abre su ficha con ingredientes, alérgenos, si es apto para veganos y vegetarianos y la información nutricional. Los datos del comercio mandan y [Open Food Facts](https://world.openfoodfacts.org), buscando por el código de barras, completa lo que falte y da la aptitud vegana, que es orientativa:

  | Comercio | Del comercio | Código de barras (Open Food Facts) |
  |---|---|---|
  | Mercadona | Ingredientes y alérgenos | Sí |
  | BM | Ingredientes, alérgenos y nutrición, si tiene ficha | Sí |
  | Costco | Ingredientes y alérgenos | Sí |
  | El Corte Inglés | Ingredientes, alérgenos y nutrición, si tiene ficha | Sí |
  | Alcampo | Ingredientes y nutrición | A veces |
  | Dia, Eroski | Ingredientes y nutrición | No |
  | Carrefour, Consum, Lidl, Action | — | Sí |

  Aldi no publica ni ingredientes ni código de barras; Lupa, las perfumerías, las tiendas de mascotas y Amazon no tienen ficha, y en ellos el modal solo muestra los datos del resultado.
- Guarda productos en una lista de la compra separada por comercio, con cantidades, subtotales y casillas para marcar lo ya comprado y quitarlo.
- Recuerda en el navegador el código postal, los comercios elegidos, la última ordenación y la lista de la compra.
- Muestra los resultados según responde cada comercio, sin esperar al más lento; un intento que tarda más de 10 s se da por fallido.
- Si un comercio falla (error, bloqueo antibots o más de 10 s sin respuesta), lo reintenta hasta 3 veces, cada una tras una cuenta atrás de 10 s que se ve en su etiqueta («no responde · reintentando en 10»).
- Pinta los resultados por bloques al hacer scroll, para gastar menos datos.
- Guarda cada búsqueda 10 minutos: repetirla o cambiar los comercios marcados no vuelve a pedir lo ya recibido.

## Cómo usarlo en local

No hay que compilar ni instalar nada: basta con abrir `index.html` con doble clic.

Si se prefiere servirlo como en GitHub Pages:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

y abrir http://127.0.0.1:8080/. Vale cualquier puerto libre: el proxy acepta `localhost` y `127.0.0.1` en todos.

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
| `algolia.js` / `aktios.js` / `iskaypet.js` | Lógica común de las plataformas que comparten varios comercios |
| `search.js` | Formulario de búsqueda (solo busca al pulsar «Buscar») |
| `results.js` | Estados, comercios que aún cargan o no responden y rejilla de productos con carga por scroll |
| `sort.js` | Opciones de ordenación |
| `store-filter.js` | Selección de comercios |
| `dropdown.js` | Desplegables de comercios y ordenación: lista cerrada en móvil y tablet, chips abiertos en PC |
| `postal-code.js` | Código postal |
| `cart.js` | Lista de la compra: botón con contador en la cabecera y modal con los productos agrupados por comercio |
| `product-detail.js` | Ficha del producto: modal que se abre al pulsar una tarjeta, con ingredientes, alérgenos, aptitud vegana y valores nutricionales |
| `open-food-facts.js` | Cliente de Open Food Facts: busca el producto por su código de barras |

Cada componente es un objeto literal global con `constants`, `globals`, `elements`, `init()` y `listeners()`. No se usan módulos ES para que la página funcione abierta desde `file://`.

## Proxy

La mayoría de comercios no permiten peticiones desde otras webs (CORS). Esas peticiones pasan por un Cloudflare Worker (`utils.constants.PROXY_URL`), cuyo código está en [`proxy/worker.js`](proxy/worker.js) con los pasos para desplegarlo en otra cuenta. El Worker:

- solo reenvía a los dominios de su lista `ALLOWED_HOSTS` y solo acepta los orígenes de `ALLOWED_ORIGINS` (GitHub Pages y `file://`) y `localhost` o `127.0.0.1` en cualquier puerto (`LOCAL_ORIGIN_PATTERN`);
- no reenvía cookies ni cabeceras de origen, y no sigue redirecciones;
- devuelve las respuestas comprimidas;
- guarda 30 minutos en la caché de Cloudflare, compartida por todos los visitantes, las respuestas que son resultados de verdad: JSON con estado 200, o HTML con la marca de resultados de su comercio (`CACHE_HTML_MARKERS`), para no guardar un captcha. Así una búsqueda repetida no vuelve a llegar al comercio y su antibots bloquea menos el proxy. La cabecera `X-Mercadin-Cache` dice si la respuesta sale de la caché (`HIT`) o del comercio (`MISS`).

Druni busca en Doofinder, que solo responde a peticiones que vienen de druni.es: para ese dominio (`UPSTREAM_ORIGINS`), el Worker envía como origen la web de Druni.

Las fichas de producto van por el proxy, incluidas las de Mercadona (`tienda.mercadona.es`) y la nutricional de BM (`cdn-bm.aktiosdigitalservices.com`); las de Lidl y Eroski son HTML y tienen su marca en `CACHE_HTML_MARKERS`. Open Food Facts va directo, porque admite CORS.

Aldi, Mercadona y Primor van directos, sin proxy: su buscador ya permite peticiones desde otras webs y responde comprimido. Lidl también las permite, pero va por el proxy porque responde sin comprimir.

## Añadir un comercio

1. Crear `js/stores/<comercio>.js` con el contrato de adaptador:
   - `constants`: `ID`, `NAME`, `LOGO_URL`, `MODE`, endpoint y parámetros;
   - `isAvailable(postalCode)`: si el comercio da servicio en ese código postal;
   - `loadCoverage()` (opcional): carga al abrir la página la zona de reparto que luego consulta `isAvailable`;
   - `search(term, signal)`: lanza la petición y devuelve la respuesta cruda (con `utils.requestJson` si va directo, o `utils.requestProxiedJson` si va por el proxy);
   - `toProducts(raw)`: mapea la respuesta a los campos del modelo común (`id`, `name`, `brand`, `imageUrl`, `price`, `previousPrice`, `unitPrice`/`unitScale` o `packageText`, `available`, `categories` y, si el buscador lo trae, `ean` y `detailRef`);
   - `getDetail(item, signal)` (opcional): pide la ficha del producto y devuelve los campos que tenga de `{ ean, ingredients, allergens, nutrition }`. Los textos pueden traer HTML (solo se conservan las negritas) y `nutrition` son filas hechas con `product.createNutrient()`. Lo que necesite para pedir la ficha (URL, identificadores…) lo guarda `toProducts` en `detailRef`. Sin `ean` ni `getDetail`, la ficha del producto sale sin ingredientes.
2. Añadir su `<script defer>` en `index.html`, antes de los componentes de `js/core`.
3. Añadirlo a `STORES` en `js/core/app.js`.
4. Si va por proxy, añadir su dominio a `ALLOWED_HOSTS` del Worker.

Si una escala de unidad no se reconoce, el producto se descarta y se avisa en consola; se añade la escala a `UNIT_SCALES` en `product.js`.

## Puntos frágiles

- **Action** recibe una consulta GraphQL propia escrita en `js/stores/action.js`: si Action cambia los nombres de sus campos, hay que ajustarla.
- **Eroski** no tiene API JSON: se lee el HTML de su listado, así que depende de sus clases CSS.
- **Costco** muestra los precios de su tienda en Uber Eats, no los de la tienda física.
- **Amazon** tampoco tiene API: se lee el HTML de su página de resultados (depende de sus atributos `data-cy` y clases `a-price`) y puede pedir captcha si detecta demasiadas peticiones desde el proxy.
- **Lupa** solo reparte en parte del norte y su API no publica la zona: los códigos postales se leen en cada visita del desplegable «Zonas de reparto» del pie de lupaonline.com. Si cambian ese desplegable, con código postal Lupa deja de aparecer y se avisa en consola.
- **Druni** usa el identificador público de su buscador Doofinder (`hashid`): si Druni lo cambia, hay que copiarlo de nuevo de su web.
- **Kiwoko y Tiendanimal** no tienen API: se lee el HTML de su rejilla de resultados (depende de sus clases `isk-product-card`). En los productos con varios tamaños, el precio es el más bajo y el precio por kilo, el más bajo que muestra la tarjeta, que puede ser de otro tamaño.
- **Zooplus** no tiene API: se piden los datos de su página de resultados de Next.js (cabecera `RSC`) y se lee el estado `initialStoreState`. Si cambian su web, puede cambiar ese formato.

## Licencia

[MIT](LICENSE)
