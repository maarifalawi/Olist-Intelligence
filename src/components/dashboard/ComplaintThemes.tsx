import React, { useState, useMemo } from 'react';
import { OrderLevelMart } from '@/lib/types';
import { analyzeThemes, compareThemesByLateness, getReviewTextStats } from '@/lib/nlpAnalysis';
import { DashboardSection } from './DashboardSection';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, MessageSquare, TrendingUp, TrendingDown, Languages, Download, Star, FileText } from 'lucide-react';

interface ComplaintThemesProps {
  orders: OrderLevelMart[];
}

// Manual translations for common Portuguese reviews to Indonesian
const reviewTranslations: Record<string, string> = {
  // Positive reviews - Delivery
  "produto chegou antes do prazo": "Produk tiba lebih cepat dari jadwal",
  "entrega muito rápida": "Pengiriman sangat cepat",
  "entrega rápida": "Pengiriman cepat",
  "chegou antes do previsto": "Tiba lebih cepat dari perkiraan",
  "entrega no prazo": "Pengiriman tepat waktu",
  "chegou certinho": "Tiba dengan baik",
  "entrega perfeita": "Pengiriman sempurna",
  "entregue antes": "Dikirim lebih awal",
  "entrega super rápida": "Pengiriman super cepat",
  "chegou rápido": "Tiba dengan cepat",
  "prazo de entrega": "Waktu pengiriman",
  "entrega foi rápida": "Pengirimannya cepat",
  
  // Positive reviews - Product Quality
  "produto de ótima qualidade": "Produk berkualitas sangat baik",
  "excelente produto": "Produk luar biasa",
  "produto bom": "Produk bagus",
  "ótimo produto": "Produk hebat",
  "produto excelente": "Produk luar biasa",
  "qualidade excelente": "Kualitas luar biasa",
  "boa qualidade": "Kualitas bagus",
  "muito bom": "Sangat bagus",
  "perfeito": "Sempurna",
  "produto perfeito": "Produk sempurna",
  "ótima qualidade": "Kualitas hebat",
  "super recomendo": "Sangat saya rekomendasikan",
  "produto maravilhoso": "Produk luar biasa",
  "produto lindo": "Produk indah",
  "amei o produto": "Saya menyukai produknya",
  "adorei": "Saya sangat suka",
  
  // Positive reviews - General
  "recomendo": "Saya merekomendasikan",
  "veio certinho": "Datang dengan benar",
  "tudo ok": "Semua ok",
  "tudo certo": "Semua benar",
  "gostei muito": "Saya sangat suka",
  "gostei": "Saya suka",
  "muito satisfeito": "Sangat puas",
  "satisfeito": "Puas",
  "atendeu expectativas": "Memenuhi ekspektasi",
  "superou expectativas": "Melebihi ekspektasi",
  "ótimo": "Hebat",
  "excelente": "Luar biasa",
  "muito bem embalado": "Dikemas dengan sangat baik",
  "embalagem perfeita": "Kemasan sempurna",
  "bem embalado": "Dikemas dengan baik",
  "produto conforme descrito": "Produk sesuai deskripsi",
  "como na foto": "Seperti di foto",
  "igual a foto": "Sama seperti foto",
  "vale a pena": "Layak dibeli",
  "custo benefício": "Nilai uang yang baik",
  "bom custo benefício": "Nilai uang yang bagus",
  "voltarei a comprar": "Akan membeli lagi",
  "comprarei novamente": "Akan membeli lagi",
  
  // Negative reviews - Delivery Issues
  "demora na entrega": "Pengiriman terlambat",
  "atraso na entrega": "Keterlambatan pengiriman",
  "demorou muito": "Sangat lama",
  "não chegou": "Tidak sampai",
  "não recebi": "Saya tidak menerima",
  "não recebi o produto": "Saya tidak menerima produk",
  "entrega atrasada": "Pengiriman terlambat",
  "muito demorado": "Sangat lama",
  "demorou para chegar": "Lama sampai",
  "prazo estourado": "Melewati batas waktu",
  "fora do prazo": "Di luar jadwal",
  "passou do prazo": "Melewati jadwal",
  "nunca chegou": "Tidak pernah sampai",
  "extraviado": "Hilang",
  "produto extraviado": "Produk hilang",
  
  // Negative reviews - Product Issues
  "produto chegou danificado": "Produk tiba dalam keadaan rusak",
  "produto diferente do anunciado": "Produk berbeda dari yang diiklankan",
  "produto não funciona": "Produk tidak berfungsi",
  "péssima qualidade": "Kualitas sangat buruk",
  "não recomendo": "Tidak saya rekomendasikan",
  "veio errado": "Datang salah",
  "faltou peças": "Ada bagian yang hilang",
  "embalagem ruim": "Kemasan buruk",
  "veio quebrado": "Datang pecah/rusak",
  "produto quebrado": "Produk rusak",
  "defeito": "Cacat",
  "com defeito": "Ada cacat",
  "produto com defeito": "Produk cacat",
  "não funcionou": "Tidak berfungsi",
  "parou de funcionar": "Berhenti berfungsi",
  "qualidade ruim": "Kualitas buruk",
  "má qualidade": "Kualitas buruk",
  "produto ruim": "Produk buruk",
  "péssimo": "Sangat buruk",
  "horrível": "Mengerikan",
  "produto errado": "Produk salah",
  "veio diferente": "Datang berbeda",
  "não é original": "Bukan asli",
  "falsificado": "Palsu",
  "incompleto": "Tidak lengkap",
  "faltando peças": "Bagian hilang",
  "falta de peças": "Kurang bagian",
  "embalagem danificada": "Kemasan rusak",
  "mal embalado": "Dikemas dengan buruk",
  "produto menor": "Produk lebih kecil",
  "tamanho errado": "Ukuran salah",
  "cor diferente": "Warna berbeda",
  
  // Negative reviews - Service Issues
  "péssimo atendimento": "Pelayanan sangat buruk",
  "atendimento ruim": "Pelayanan buruk",
  "sem resposta": "Tidak ada jawaban",
  "não responderam": "Mereka tidak menjawab",
  "difícil contato": "Sulit dihubungi",
  "sem suporte": "Tanpa dukungan",
  "golpe": "Penipuan",
  "fraude": "Penipuan",
  "enganação": "Tipu daya",
  "propaganda enganosa": "Iklan menyesatkan",
  "arrependido": "Menyesal",
  "me arrependi": "Saya menyesal",
  "dinheiro jogado fora": "Uang terbuang",
  "perda de dinheiro": "Buang-buang uang",
  "quero reembolso": "Saya ingin pengembalian dana",
  "pedir reembolso": "Minta pengembalian dana",
  "devolução": "Pengembalian",
  "quero devolver": "Saya ingin mengembalikan",
  
  // Neutral/Mixed reviews
  "produto ok": "Produk ok",
  "razoável": "Lumayan",
  "normal": "Normal",
  "nada demais": "Biasa saja",
  "poderia ser melhor": "Bisa lebih baik",
  "esperava mais": "Mengharapkan lebih",
  "mediano": "Rata-rata",
  "regular": "Biasa",
};

// Comprehensive translation function - builds a full translation from detected elements
function translateReview(portugueseText: string): string {
  const lowerText = portugueseText.toLowerCase();
  
  // Word-by-word translation dictionary for building sentences
  const wordTranslations: Record<string, string> = {
    // Verbs & Actions
    "gostei": "saya suka",
    "adorei": "saya sangat suka",
    "amei": "saya menyukai",
    "recomendo": "saya rekomendasikan",
    "chegou": "tiba/sampai",
    "recebi": "saya menerima",
    "comprei": "saya membeli",
    "esperava": "saya berharap",
    "fiquei": "saya merasa",
    "preocupada": "khawatir",
    "preocupado": "khawatir",
    
    // Nouns
    "produto": "produk",
    "entrega": "pengiriman",
    "prazo": "tenggat waktu",
    "qualidade": "kualitas",
    "embalagem": "kemasan",
    "atendimento": "pelayanan",
    "vendedor": "penjual",
    "loja": "toko",
    "correios": "kantor pos",
    "transportadora": "kurir",
    "status": "status",
    "compra": "pembelian",
    "pedido": "pesanan",
    "presente": "hadiah",
    "bolo": "kue",
    "fake": "palsu/tiruan",
    
    // Adjectives
    "bom": "bagus",
    "ótimo": "hebat",
    "excelente": "luar biasa",
    "perfeito": "sempurna",
    "lindo": "indah",
    "bonito": "cantik",
    "ruim": "buruk",
    "péssimo": "sangat buruk",
    "rápido": "cepat",
    "rápida": "cepat",
    "último": "terakhir",
    "ultimo": "terakhir",
    "atrasado": "terlambat",
    "atualizado": "diperbarui",
    
    // Time expressions
    "antes": "sebelum",
    "depois": "setelah",
    "tempo": "waktu",
    "dia": "hari",
    "dias": "hari",
    
    // Connectors
    "porem": "tetapi",
    "porém": "tetapi",
    "mas": "tapi",
    "porque": "karena",
    "pois": "karena",
    "muito": "sangat",
    "não": "tidak",
    "nao": "tidak",
    "de": "dari/tentang",
    "para": "untuk",
    
    // Service related
    "greve": "mogok kerja",
    "atraso": "keterlambatan",
    "aviso": "pemberitahuan",
    "resposta": "jawaban",
    "empresa": "perusahaan",
    "responsável": "bertanggung jawab",
  };

  // Detect themes and build comprehensive translation
  const detectedElements: string[] = [];
  
  // Check for specific contexts
  if (lowerText.includes("greve") || lowerText.includes("correios")) {
    detectedElements.push("🏤 Tentang kantor pos/kurir");
  }
  if (lowerText.includes("gostei") || lowerText.includes("adorei") || lowerText.includes("amei")) {
    detectedElements.push("👍 Pelanggan menyukai");
  }
  if (lowerText.includes("produto")) {
    detectedElements.push("📦 Membahas produk");
  }
  if (lowerText.includes("entrega") || lowerText.includes("chegou") || lowerText.includes("prazo")) {
    detectedElements.push("🚚 Membahas pengiriman/waktu");
  }
  if (lowerText.includes("preocup")) {
    detectedElements.push("😟 Pelanggan khawatir");
  }
  if (lowerText.includes("atraso") || lowerText.includes("atrasado") || lowerText.includes("demor")) {
    detectedElements.push("⏰ Ada keterlambatan");
  }
  if (lowerText.includes("não") && (lowerText.includes("recebi") || lowerText.includes("chegou"))) {
    detectedElements.push("❌ Tidak menerima/tidak sampai");
  }
  if (lowerText.includes("status") || lowerText.includes("atualizado")) {
    detectedElements.push("📱 Tentang status/update");
  }
  if (lowerText.includes("qualidade")) {
    detectedElements.push("⭐ Membahas kualitas");
  }
  if (lowerText.includes("bom") || lowerText.includes("ótimo") || lowerText.includes("excelente") || lowerText.includes("perfeito")) {
    detectedElements.push("✅ Penilaian positif");
  }
  if (lowerText.includes("ruim") || lowerText.includes("péssimo") || lowerText.includes("horrível")) {
    detectedElements.push("❌ Penilaian negatif");
  }
  if (lowerText.includes("recomendo")) {
    if (lowerText.includes("não recomendo")) {
      detectedElements.push("👎 Tidak merekomendasikan");
    } else {
      detectedElements.push("👍 Merekomendasikan");
    }
  }
  if (lowerText.includes("fake") || lowerText.includes("falso")) {
    detectedElements.push("⚠️ Menyebut produk palsu/tiruan");
  }
  if (lowerText.includes("presente")) {
    detectedElements.push("🎁 Untuk hadiah");
  }
  if (lowerText.includes("último dia") || lowerText.includes("ultimo dia")) {
    detectedElements.push("📅 Sampai di hari terakhir");
  }
  if (lowerText.includes("atendimento")) {
    detectedElements.push("💬 Membahas pelayanan");
  }
  if (lowerText.includes("empresa") && lowerText.includes("resposta")) {
    detectedElements.push("📞 Menunggu respon perusahaan");
  }

  if (detectedElements.length > 0) {
    // Build a summary
    let summary = "📝 Ringkasan: ";
    
    // Determine overall sentiment
    const positiveWords = ['gostei', 'adorei', 'amei', 'bom', 'ótimo', 'excelente', 'perfeito', 'recomendo', 'lindo', 'bonito', 'satisfeito'];
    const negativeWords = ['ruim', 'péssimo', 'não', 'problema', 'atraso', 'defeito', 'preocup', 'horrível'];
    
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    
    if (positiveCount > negativeCount) {
      summary += "Review cenderung POSITIF. ";
    } else if (negativeCount > positiveCount) {
      summary += "Review cenderung NEGATIF. ";
    } else {
      summary += "Review CAMPURAN. ";
    }

    return summary + "\n\n" + detectedElements.join(" | ");
  }
  
  return "Terjemahan tidak tersedia - review dalam Bahasa Portugis";
}

export function ComplaintThemes({ orders }: ComplaintThemesProps) {
  const [showIndonesian, setShowIndonesian] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  
  const themes = analyzeThemes(orders);
  const comparison = compareThemesByLateness(orders);
  const stats = getReviewTextStats(orders);
  
  // Filter themes based on selection
  const filteredThemes = useMemo(() => {
    let result = selectedTheme === 'all' 
      ? themes 
      : themes.filter(t => t.theme === selectedTheme);
    
    // Filter examples by rating if selected
    if (selectedRating !== 'all') {
      const ratingNum = parseInt(selectedRating);
      result = result.map(theme => ({
        ...theme,
        examplesWithScore: theme.examplesWithScore.filter(ex => ex.score === ratingNum),
      })).filter(theme => theme.examplesWithScore.length > 0);
    }
    
    return result;
  }, [themes, selectedTheme, selectedRating]);

  // Export to CSV
  const exportToCSV = () => {
    const rows: string[][] = [['Tema', 'Review (Portugis)', 'Terjemahan (Indonesia)', 'Rating']];
    
    filteredThemes.forEach(theme => {
      theme.examplesWithScore.forEach(ex => {
        rows.push([
          theme.theme,
          `"${ex.text.replace(/"/g, '""')}"`,
          `"${translateReview(ex.text).replace(/"/g, '""')}"`,
          ex.score?.toString() || 'N/A',
        ]);
      });
    });
    
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF (text-based)
  const exportToPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Analisis Review Pelanggan', 20, 20);
    doc.setFontSize(10);
    doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID')}`, 20, 28);
    
    let yPos = 40;
    
    filteredThemes.forEach(theme => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${theme.theme} (${theme.count} reviews)`, 20, yPos);
      yPos += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      theme.examplesWithScore.slice(0, 3).forEach(ex => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const rating = ex.score ? `[${ex.score}/5]` : '';
        const reviewText = ex.text.slice(0, 80);
        doc.text(`${rating} ${reviewText}...`, 25, yPos, { maxWidth: 160 });
        yPos += 6;
        
        const translation = translateReview(ex.text).split('\n')[0].slice(0, 80);
        doc.setTextColor(100);
        doc.text(`ID: ${translation}`, 25, yPos, { maxWidth: 160 });
        doc.setTextColor(0);
        yPos += 10;
      });
      
      yPos += 5;
    });
    
    doc.save(`review_analysis_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  if (themes.length === 0) {
    return (
      <DashboardSection title="Analisis Tema Keluhan" subtitle="NLP Keyword Extraction">
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Tidak ada review text yang tersedia untuk analisis.</p>
          <p className="text-sm mt-1">Coverage text: {stats.textCoverage.toFixed(1)}%</p>
        </div>
      </DashboardSection>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <DashboardSection title="Statistik Review Text">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold font-mono">{stats.totalReviews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Reviews</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold font-mono">{stats.reviewsWithText.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Dengan Text</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold font-mono">{stats.textCoverage.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Coverage Text</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold font-mono">{Math.round(stats.avgTextLength)}</p>
            <p className="text-xs text-muted-foreground">Avg Karakter</p>
          </div>
        </div>
      </DashboardSection>

      {/* Theme Distribution */}
      <DashboardSection 
        title="Distribusi Tema Keluhan" 
        subtitle="Berdasarkan keyword extraction dari review text"
      >
        <div className="space-y-4">
          {themes.slice(0, 8).map((theme) => (
            <div key={theme.theme} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{theme.theme}</span>
                  <Badge variant="secondary" className="text-xs">
                    {theme.count} reviews
                  </Badge>
                </div>
                <span className="text-sm font-mono">{theme.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={theme.percentage} className="h-2" />
              <div className="flex flex-wrap gap-1">
                {theme.topKeywords.slice(0, 5).map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Late vs On-Time Comparison */}
      {comparison.length > 0 && (
        <DashboardSection 
          title="Perbandingan Tema: Late vs On-Time" 
          subtitle="Perbedaan proporsi tema antara order terlambat dan tepat waktu"
        >
          <div className="space-y-3">
            {comparison.slice(0, 6).map((item) => (
              <Card key={item.theme} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{item.theme}</span>
                  <div className="flex items-center gap-1">
                    {item.difference > 0 ? (
                      <TrendingUp className="w-4 h-4 text-destructive" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-chart-2" />
                    )}
                    <span className={`text-sm font-mono ${item.difference > 0 ? 'text-destructive' : 'text-chart-2'}`}>
                      {item.difference > 0 ? '+' : ''}{item.difference.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Late:</span>
                    <span className="font-mono">{item.latePercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">On-Time:</span>
                    <span className="font-mono">{item.onTimePercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Nilai positif = lebih sering muncul pada order terlambat
          </p>
        </DashboardSection>
      )}

      {/* Contoh Review */}
      <DashboardSection 
        title="Contoh Review per Tema" 
        subtitle="Filter dan lihat review berdasarkan tema dan rating"
      >
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tema:</span>
            <Select value={selectedTheme} onValueChange={setSelectedTheme}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pilih tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tema</SelectItem>
                {themes.map((theme) => (
                  <SelectItem key={theme.theme} value={theme.theme}>
                    {theme.theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rating:</span>
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Rating</SelectItem>
                <SelectItem value="1">⭐ 1 Bintang</SelectItem>
                <SelectItem value="2">⭐ 2 Bintang</SelectItem>
                <SelectItem value="3">⭐ 3 Bintang</SelectItem>
                <SelectItem value="4">⭐ 4 Bintang</SelectItem>
                <SelectItem value="5">⭐ 5 Bintang</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant={showIndonesian ? "default" : "outline"}
            size="sm"
            onClick={() => setShowIndonesian(!showIndonesian)}
            className="gap-2"
          >
            <Languages className="w-4 h-4" />
            {showIndonesian ? "Indonesia" : "Portugis"}
          </Button>
          
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Reviews */}
        <div className="space-y-4">
          {filteredThemes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>Tidak ada review dengan filter ini.</p>
            </div>
          ) : (
            filteredThemes.slice(0, 4).map((theme) => (
              <div key={theme.theme} className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  {theme.theme}
                  <Badge variant="secondary" className="text-xs">{theme.count} reviews</Badge>
                </h4>
                <div className="space-y-2">
                  {theme.examplesWithScore.slice(0, 3).map((example, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg text-sm">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-muted-foreground italic flex-1">"{example.text}"</p>
                        {example.score && (
                          <Badge variant="outline" className="shrink-0 gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            {example.score}
                          </Badge>
                        )}
                      </div>
                      {showIndonesian && (
                        <p className="text-foreground mt-2 pt-2 border-t border-border/50 text-xs">
                          🇮🇩 {translateReview(example.text)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          💡 Review asli dari Olist Brazilian E-Commerce dataset. Klik tombol "Indonesia" untuk melihat terjemahan.
        </p>
      </DashboardSection>
    </div>
  );
}
