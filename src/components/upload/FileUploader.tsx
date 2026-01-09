import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileIndicator } from './FileIndicator';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useData } from '@/context/DataContext';
import { REQUIRED_FILES, FileKey } from '@/lib/constants';
import { validateFile, identifyFileType } from '@/lib/validation';
import { parseDatasets, buildOrderMart } from '@/lib/dataProcessing';
import { cn } from '@/lib/utils';

export function FileUploader() {
  const {
    rawFiles,
    fileValidations,
    setRawFile,
    setFileValidation,
    setDatasets,
    setOrderMart,
    setBuildProgress,
    setIsBuilding,
    isBuilding,
    buildProgress,
    buildMessage,
  } = useData();

  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.csv')) continue;
      
      const fileType = identifyFileType(file.name);
      if (!fileType) {
        console.warn(`Tidak dapat mengidentifikasi tipe file: ${file.name}`);
        continue;
      }
      
      const content = await file.text();
      setRawFile(fileType, content);
      
      const validation = validateFile(fileType, content);
      setFileValidation(fileType, validation);
    }
  }, [setRawFile, setFileValidation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const uploadedCount = REQUIRED_FILES.filter(f => rawFiles[f.key as FileKey]).length;
  const allUploaded = uploadedCount === REQUIRED_FILES.length;
  const allValid = REQUIRED_FILES.every(f => {
    const validation = fileValidations[f.key as FileKey];
    return validation?.isValid === true;
  });

  const canBuild = allUploaded && allValid && !isBuilding;

  const handleBuildMart = useCallback(async () => {
    if (!canBuild) return;
    
    setIsBuilding(true);
    setBuildProgress(0, 'Memulai...');
    
    try {
      // Small delay to let UI update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setBuildProgress(5, 'Memparse dataset...');
      const datasets = parseDatasets(rawFiles as Record<FileKey, string>);
      setDatasets(datasets);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { mart, quality } = buildOrderMart(datasets, (progress, message) => {
        setBuildProgress(progress, message);
      });
      
      setOrderMart(mart, quality);
      setBuildProgress(100, 'Selesai!');
      
      // Keep progress visible briefly
      setTimeout(() => {
        setIsBuilding(false);
      }, 1000);
    } catch (error) {
      console.error('Error building mart:', error);
      setBuildProgress(0, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsBuilding(false);
    }
  }, [canBuild, rawFiles, setDatasets, setOrderMart, setBuildProgress, setIsBuilding]);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          dragActive ? 'border-primary bg-accent/50' : 'border-border hover:border-primary/50',
          isBuilding && 'opacity-50 pointer-events-none'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".csv"
          multiple
          onChange={handleInputChange}
          className="hidden"
          id="file-upload"
          disabled={isBuilding}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-accent rounded-full">
              <Upload className="w-8 h-8 text-accent-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">
                Seret & letakkan file CSV di sini
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                atau klik untuk memilih file
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload 9 file dataset Olist sekaligus
            </p>
          </div>
        </label>
      </div>

      {/* File Checklist */}
      <div className="dashboard-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Checklist File ({uploadedCount}/9)
          </h3>
          {allUploaded && allValid && (
            <span className="badge-success">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Semua file valid
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REQUIRED_FILES.map((file) => {
            const key = file.key as FileKey;
            const validation = fileValidations[key];
            const isUploaded = !!rawFiles[key];
            
            return (
              <FileIndicator
                key={key}
                filename={file.display}
                uploaded={isUploaded}
                rows={validation?.rowCount}
                columns={validation?.columnCount}
                hasErrors={validation?.isValid === false}
              />
            );
          })}
        </div>

        {/* Validation Errors */}
        {Object.entries(fileValidations).some(([_, v]) => v && !v.isValid) && (
          <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
            <h4 className="font-medium text-destructive flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              Error Validasi
            </h4>
            <ul className="text-sm space-y-1">
              {Object.entries(fileValidations)
                .filter(([_, v]) => v && !v.isValid)
                .flatMap(([key, v]) =>
                  v!.errors.map((err, i) => (
                    <li key={`${key}-${i}`} className="text-destructive">
                      <strong>{err.file}:</strong> {err.message}
                      {err.suggestion && (
                        <span className="text-muted-foreground"> — {err.suggestion}</span>
                      )}
                    </li>
                  ))
                )}
            </ul>
          </div>
        )}
      </div>

      {/* Build Button */}
      <div className="flex flex-col items-center gap-4">
        {isBuilding && (
          <div className="w-full max-w-md">
            <ProgressBar
              value={buildProgress}
              label={buildMessage}
              size="md"
            />
          </div>
        )}
        
        <Button
          size="lg"
          onClick={handleBuildMart}
          disabled={!canBuild}
          className="min-w-[200px]"
        >
          {isBuilding ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            'Bangun Data Mart'
          )}
        </Button>
        
        {!allUploaded && (
          <p className="text-sm text-muted-foreground">
            Upload semua 9 file untuk melanjutkan
          </p>
        )}
        {allUploaded && !allValid && (
          <p className="text-sm text-destructive">
            Perbaiki error validasi sebelum melanjutkan
          </p>
        )}
      </div>
    </div>
  );
}
