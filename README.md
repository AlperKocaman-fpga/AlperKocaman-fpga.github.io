# Alper Kocaman · Portföy sitesi

GitHub Pages üzerinde doğrudan yayınlanabilen, derleme adımı gerektirmeyen statik site (HTML + CSS + JS).

## Yapı

```
.
├── index.html                      # Ana sayfa: hero simülasyonu, projeler, yetenekler, hakkımda, iletişim
├── projects/
│   ├── radar-vital-signs.html      # TÜBİTAK 2209-A radar projesi (ayrıntılı)
│   └── fpga-fft.html               # Xilinx FFT IP bitirme projesi
├── assets/
│   ├── css/style.css               # Tüm stiller (renk/tipografi değişkenleri en üstte)
│   ├── js/main.js                  # Dil düğmesi, menü, görsel büyütme, hero radar simülasyonu
│   ├── img/                        # radar/, radar-fpga/, fpga-fft/ görselleri
│   └── favicon.svg
├── 404.html
└── .nojekyll
```

## Yayınlama (GitHub Pages)

1. GitHub'da **`AlperKocaman-fpga.github.io`** adında yeni, herkese açık bir depo oluştur.
   (Bu adı kullanırsan site `https://alperkocaman-fpga.github.io` adresinde açılır.
   Başka bir ad kullanırsan adres `https://alperkocaman-fpga.github.io/<depo-adı>/` olur; tüm bağlantılar göreli olduğu için ikisi de çalışır.)
2. Bu klasörün **içeriğini** deponun köküne yükle (`index.html` kökte olmalı).
   - Web arayüzünden: *Add file → Upload files*, tüm dosya ve klasörleri sürükle bırak.
   - Ya da komut satırından:
     ```bash
     git init
     git add .
     git commit -m "Portföy sitesi"
     git branch -M main
     git remote add origin https://github.com/AlperKocaman-fpga/AlperKocaman-fpga.github.io.git
     git push -u origin main
     ```
3. Depoda **Settings → Pages → Build and deployment**: *Source* = **Deploy from a branch**, *Branch* = **main**, klasör **/ (root)** → *Save*.
4. Bir iki dakika içinde site yayında olur.

## Düzenleme

- **Dil:** Her metnin Türkçesi `data-l="tr"`, İngilizcesi `data-l="en"` içinde yan yana durur. Birini değiştirirken diğerini de güncelle. Varsayılan dil Türkçe; ziyaretçinin seçimi tarayıcısında hatırlanır.
- **Renkler ve yazı tipi:** `assets/css/style.css` dosyasının başındaki `:root` değişkenleri. Renkler radar arayüzündeki kanal renklerinden alındı: camgöbeği = I kanalı, turuncu = Q kanalı.
- **Yeni proje:** `projects/fpga-fft.html` dosyasını kopyalayıp içeriğini değiştir, sonra `index.html` içindeki *Diğer çalışmalar* bölümüne bir kart ekle.
- **Görseller:** `assets/img/` altına koy, genişliği 1600 px'i geçmesin.

## Yerelde önizleme

```bash
python3 -m http.server 8000
# tarayıcıda http://localhost:8000
```

Dış bağımlılıklar yalnızca Google Fonts (Archivo) ve radar sayfasındaki denklemler için KaTeX (jsDelivr CDN).
