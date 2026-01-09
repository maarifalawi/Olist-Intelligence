import { FileUploader } from '@/components/upload/FileUploader';
import { useData } from '@/context/DataContext';
import { CheckCircle2, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function UploadPage() {
  const { orderMart, dataQuality, buildTimestamp } = useData();
  const navigate = useNavigate();
  const hasData = orderMart.length > 0;

  // Auto-navigate to ops page after successful build
  useEffect(() => {
    if (hasData && buildTimestamp) {
      const timeSinceBuild = Date.now() - buildTimestamp.getTime();
      if (timeSinceBuild < 2000) {
        setTimeout(() => navigate('/ops'), 1500);
      }
    }
  }, [hasData, buildTimestamp, navigate]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Upload Data</h1>
        <p className="text-muted-foreground mt-2">
          Upload 9 file CSV dataset Olist Brazilian E-Commerce untuk memulai analisis
        </p>
      </div>

      {hasData && dataQuality ? (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="dashboard-section bg-success/5 border-success/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-success/10 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Data Mart Berhasil Dibangun!
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Diproses pada {buildTimestamp?.toLocaleString('id-ID')}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-2xl font-bold font-mono">
                      {dataQuality.total_orders.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono">
                      {dataQuality.delivered_orders.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Delivered</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono">
                      {dataQuality.orders_with_reviews.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Dengan Review</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono">
                      {dataQuality.orders_with_geo.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Dengan Geo</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button onClick={() => navigate('/ops')}>
                    <Database className="w-4 h-4 mr-2" />
                    Lihat Dashboard Ops
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/quality')}>
                    Lihat Kualitas Data
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Re-upload option */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Upload ulang dataset?
            </h3>
            <FileUploader />
          </div>
        </div>
      ) : (
        <FileUploader />
      )}
    </div>
  );
}
