"""Render del ticket con QR que recibe el cliente por WhatsApp.

Se arma con Pillow en lugar de mandar el QR pelon: el asistente ve el logo del
evento, su nombre y sus accesos en la misma imagen, con la paleta "Red
Underground" del flyer. El QR se mantiene oscuro sobre blanco porque los
lectores de camara necesitan ese contraste; el color se queda en el marco.
"""

from io import BytesIO

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Paleta espejo de tailwind.config.js (sg.*)
NEON = (255, 10, 46)
GLOW = (255, 51, 85)
BLOOD = (163, 0, 24)
EMBER = (61, 0, 9)
VOID = (8, 0, 3)
INK = (16, 0, 5)  # modulos del QR: casi negro con tinte rojo
WHITE = (255, 255, 255)
MUTED = (176, 146, 152)

WIDTH = 900
MARGIN = 48
LOGO_BAND = 300
QR_SIDE = 560
QR_PAD = 28

# El contenedor es python:3.12-slim con fonts-dejavu-core; el resto de las rutas
# cubren macOS y los Linux de desarrollo.
FONTS_BOLD = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
)
FONTS_REGULAR = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial.ttf",
)
FONTS_MONO = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf",
)

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    cached = _font_cache.get((kind, size))
    if cached:
        return cached

    paths = {"bold": FONTS_BOLD, "regular": FONTS_REGULAR, "mono": FONTS_MONO}[kind]
    for path in paths:
        try:
            font = ImageFont.truetype(path, size)
            break
        except OSError:
            continue
    else:
        # Sin TTF disponible: load_default(size) escala la fuente incrustada de
        # Pillow (>=10.1) en vez de dejar texto microscopico.
        try:
            font = ImageFont.load_default(size)
        except TypeError:
            font = ImageFont.load_default()

    _font_cache[(kind, size)] = font
    return font


def _text_width(draw: ImageDraw.ImageDraw, text: str, font, tracking: int) -> int:
    if not text:
        return 0
    if not tracking:
        return int(draw.textlength(text, font=font))
    return int(sum(draw.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1))


def _draw_centered(draw, y, text, font, fill, tracking=0):
    """Dibuja centrado en el ancho del ticket; `tracking` imita el letter-spacing."""
    x = (WIDTH - _text_width(draw, text, font, tracking)) / 2
    if not tracking:
        draw.text((x, y), text, font=font, fill=fill)
        return
    for char in text:
        draw.text((x, y), char, font=font, fill=fill)
        x += draw.textlength(char, font=font) + tracking


def _background(height: int) -> Image.Image:
    """Degradado vertical humo-rojo -> negro con halo detras del QR."""
    base = Image.new("RGB", (1, height))
    pixels = base.load()
    for y in range(height):
        # Doble parada: arriba arranca en ember, al 55% ya es void y abajo vuelve
        # a subir apenas para que el pie no se vea plano.
        t = y / max(height - 1, 1)
        if t < 0.55:
            k = t / 0.55
            mix = tuple(int(EMBER[i] + (VOID[i] - EMBER[i]) * k) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            mix = tuple(int(VOID[i] + (EMBER[i] - VOID[i]) * k * 0.55) for i in range(3))
        pixels[0, y] = mix

    return base.resize((WIDTH, height), Image.BILINEAR)


def _glow(img: Image.Image, box: tuple[int, int, int, int], color, radius: int, alpha: int):
    """Halo difuso alrededor de un rectangulo, al estilo del neon del flyer."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=28, fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius))
    img.alpha_composite(layer)


def _logo_band(logo_bytes: bytes) -> Image.Image | None:
    """Recorta el logo a la banda superior (equivalente a object-cover)."""
    try:
        logo = Image.open(BytesIO(logo_bytes))
        logo.load()
    except Exception:
        return None

    logo = logo.convert("RGB")
    scale = max(WIDTH / logo.width, LOGO_BAND / logo.height)
    resized = logo.resize(
        (max(int(logo.width * scale), WIDTH), max(int(logo.height * scale), LOGO_BAND)),
        Image.LANCZOS,
    )
    left = (resized.width - WIDTH) // 2
    top = (resized.height - LOGO_BAND) // 2
    return resized.crop((left, top, left + WIDTH, top + LOGO_BAND))


def _qr_image(payload: str) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_Q,  # tolera el marco y el reencuadre
        box_size=10,
        border=1,  # el margen blanco real lo da la tarjeta
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color=INK, back_color=WHITE).convert("RGB")
    return img.resize((QR_SIDE, QR_SIDE), Image.NEAREST)


def build_ticket_png(
    *,
    nombre: str,
    accesos: int,
    folio: str,
    payload: str,
    logo_bytes: bytes | None = None,
    evento: str = "SENSORY GROOVE II",
) -> bytes:
    """Devuelve el PNG del ticket listo para enviar por WhatsApp."""
    band = _logo_band(logo_bytes) if logo_bytes else None

    # Alto dinamico: sin logo la banda se sustituye por el nombre del evento.
    top = LOGO_BAND if band else 150
    height = top + 98 + QR_SIDE + 2 * QR_PAD + 396

    canvas = _background(height).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    if band:
        canvas.paste(band, (0, 0))
        # Difuminado del borde inferior para que el logo se funda con el fondo.
        fade = Image.new("RGBA", (WIDTH, 110), (0, 0, 0, 0))
        fade_px = fade.load()
        for y in range(110):
            a = int(255 * (y / 109) ** 1.4)
            for x in range(WIDTH):
                fade_px[x, y] = (*VOID, a)
        canvas.alpha_composite(fade, (0, LOGO_BAND - 110))
    else:
        _draw_centered(draw, 58, evento, _font("bold", 46), WHITE, tracking=4)

    y = top + 8
    _draw_centered(draw, y, "ACCESO CONFIRMADO", _font("bold", 30), GLOW, tracking=8)
    y += 54
    draw.line([(MARGIN + 60, y), (WIDTH - MARGIN - 60, y)], fill=(*BLOOD, 200), width=2)
    y += 36

    # --- Tarjeta del QR -------------------------------------------------------
    card_side = QR_SIDE + 2 * QR_PAD
    card_x = (WIDTH - card_side) // 2
    card_box = (card_x, y, card_x + card_side, y + card_side)
    _glow(canvas, card_box, NEON, radius=26, alpha=120)
    draw.rounded_rectangle(card_box, radius=28, fill=WHITE, outline=NEON, width=5)
    canvas.paste(_qr_image(payload), (card_x + QR_PAD, y + QR_PAD))
    y += card_side + 44

    # --- Datos del cliente ----------------------------------------------------
    _draw_centered(draw, y, "TITULAR", _font("regular", 22), MUTED, tracking=6)
    y += 32

    # El nombre baja de tamano si es largo, para no salirse del ticket.
    for size in (54, 46, 38, 32):
        nombre_font = _font("bold", size)
        if _text_width(draw, nombre, nombre_font, 0) <= WIDTH - 2 * MARGIN:
            break
    _draw_centered(draw, y, nombre, nombre_font, WHITE)
    y += nombre_font.size + 34

    col_w = (WIDTH - 2 * MARGIN - 24) // 2
    for i, (label, valor, font_kind) in enumerate(
        (("ACCESOS", str(accesos), "bold"), ("FOLIO", folio.upper(), "mono"))
    ):
        x0 = MARGIN + i * (col_w + 24)
        box = (x0, y, x0 + col_w, y + 118)
        draw.rounded_rectangle(box, radius=18, fill=(*EMBER, 150), outline=(*BLOOD, 220), width=2)
        cx = x0 + col_w / 2
        label_font = _font("regular", 20)
        draw.text(
            (cx - draw.textlength(label, font=label_font) / 2, y + 22),
            label, font=label_font, fill=MUTED,
        )
        valor_font = _font(font_kind, 44)
        draw.text(
            (cx - draw.textlength(valor, font=valor_font) / 2, y + 54),
            valor, font=valor_font, fill=GLOW if i == 0 else WHITE,
        )
    y += 150

    _draw_centered(
        draw, y, "Presenta este QR en la entrada", _font("regular", 24), MUTED, tracking=1
    )

    # Marco neon del ticket completo.
    draw.rounded_rectangle((2, 2, WIDTH - 3, height - 3), radius=8, outline=(*NEON, 210), width=4)

    buffer = BytesIO()
    canvas.convert("RGB").save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
