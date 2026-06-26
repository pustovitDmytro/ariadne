# ariadne

Інструменти для організації домашнього архіву фотографій.

Стек: Node.js, bash.

## Вимоги

- Node.js 18+

## Встановлення

```bash
cd ariadne
npm link
```

Після цього команда `ariadne` буде доступна глобально. Без `npm link` можна запускати напряму через `node` або bash-скрипт (див. нижче).

## Пошук дублів

Команда `duplicates` рекурсивно обходить папку, знаходить зображення й шукає **точні** дублікати (однаковий вміст файлу, байт-в-байт).

### Базове використання

```bash
ariadne duplicates ~/Pictures
```

Або без глобального встановлення:

```bash
node bin/ariadne.js duplicates ~/Pictures
```

Через bash-обгортку:

```bash
./scripts/find-duplicates.sh ~/Pictures
```

Через npm script (шлях передається після `--`):

```bash
npm run duplicates -- ~/Pictures
```

### Опції

| Опція | Опис |
|-------|------|
| `--json` | Вивід у форматі JSON |
| `--quiet`, `-q` | Без повідомлень про прогрес |
| `--help`, `-h` | Довідка |

### Приклади

```bash
# людиночитний вивід
ariadne duplicates /media/photos

# JSON для подальшої обробки скриптами
ariadne duplicates /media/photos --json

# тихий режим (лише результат)
ariadne duplicates /media/photos -q
```

### Формат виводу

**Текстовий** (за замовчуванням):

```
Found 2 duplicate group(s):

Group 1 (3 files):
  /home/user/Pictures/2024/img001.jpg
  /home/user/Pictures/backup/img001.jpg
  /home/user/Downloads/img001.jpg

Group 2 (2 files):
  /home/user/Pictures/vacation/photo.png
  /home/user/Pictures/old/photo.png

Total redundant files: 3
```

`Total redundant files` — скільки файлів можна видалити, залишивши по одному в кожній групі.

**JSON** (`--json`):

```json
{
  "groups": [
    [
      "/home/user/Pictures/a.jpg",
      "/home/user/Pictures/b.jpg"
    ]
  ],
  "count": 1
}
```

### Підтримувані формати

`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.heic`, `.heif`, `.avif`, `.cr2`, `.nef`, `.orf`, `.arw`, `.dng`, `.raf`

## Як це працює

1. Рекурсивний обхід каталогу.
2. Фільтрація лише файлів зображень.
3. Групування за розміром (щоб не хешувати унікальні файли).
4. SHA-256 хеш вмісту для кандидатів на дублікати.
5. Вивід груп, де більше одного файлу з однаковим хешем.

## Обмеження

Знаходяться лише **ідентичні** копії. Фото з іншим стисненням, обрізанням або зміненими EXIF-метаданими поки не вважаються дублікатами.
