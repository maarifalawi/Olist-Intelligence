// context buat manage state data di seluruh app
// dari raw files sampe order mart yang udah diproses

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { OrderLevelMart, DataQualityReport, DatasetState, DashboardFilters } from '@/lib/types';
import { FileKey } from '@/lib/constants';
import { ValidationResult } from '@/lib/validation';

interface DataContextState {
  // file mentah yang di-upload user
  rawFiles: Record<FileKey, string>;
  fileValidations: Record<FileKey, ValidationResult | null>;
  
  // dataset yang udah di-parse
  datasets: DatasetState | null;
  
  // order mart - data utama buat semua dashboard
  orderMart: OrderLevelMart[];
  dataQuality: DataQualityReport | null;
  buildTimestamp: Date | null;
  
  // state UI waktu building
  isBuilding: boolean;
  buildProgress: number;
  buildMessage: string;
  
  // filter dashboard
  filters: DashboardFilters;
  
  // actions buat update state
  setRawFile: (key: FileKey, content: string) => void;
  setFileValidation: (key: FileKey, result: ValidationResult) => void;
  setDatasets: (datasets: DatasetState) => void;
  setOrderMart: (mart: OrderLevelMart[], quality: DataQualityReport) => void;
  setBuildProgress: (progress: number, message: string) => void;
  setIsBuilding: (building: boolean) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  clearAll: () => void;
}

// filter default - kosong semua
const defaultFilters: DashboardFilters = {
  dateRange: { start: null, end: null },
  customerStates: [],
  sellerStates: [],
  categories: [],
  paymentTypes: [],
};

const DataContext = createContext<DataContextState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [rawFiles, setRawFiles] = useState<Record<FileKey, string>>({} as Record<FileKey, string>);
  const [fileValidations, setFileValidations] = useState<Record<FileKey, ValidationResult | null>>({} as Record<FileKey, ValidationResult | null>);
  const [datasets, setDatasetsState] = useState<DatasetState | null>(null);
  const [orderMart, setOrderMartState] = useState<OrderLevelMart[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQualityReport | null>(null);
  const [buildTimestamp, setBuildTimestamp] = useState<Date | null>(null);
  const [isBuilding, setIsBuildingState] = useState(false);
  const [buildProgress, setBuildProgressValue] = useState(0);
  const [buildMessage, setBuildMessageValue] = useState('');
  const [filters, setFiltersState] = useState<DashboardFilters>(defaultFilters);

  // set file mentah dari upload
  const setRawFile = useCallback((key: FileKey, content: string) => {
    setRawFiles(prev => ({ ...prev, [key]: content }));
  }, []);

  // simpen hasil validasi file
  const setFileValidation = useCallback((key: FileKey, result: ValidationResult) => {
    setFileValidations(prev => ({ ...prev, [key]: result }));
  }, []);

  // set dataset yang udah di-parse
  const setDatasets = useCallback((ds: DatasetState) => {
    setDatasetsState(ds);
  }, []);

  // set order mart + quality report sekaligus
  const setOrderMart = useCallback((mart: OrderLevelMart[], quality: DataQualityReport) => {
    setOrderMartState(mart);
    setDataQuality(quality);
    setBuildTimestamp(new Date());
  }, []);

  // update progress bar waktu building
  const setBuildProgress = useCallback((progress: number, message: string) => {
    setBuildProgressValue(progress);
    setBuildMessageValue(message);
  }, []);

  // toggle building state
  const setIsBuilding = useCallback((building: boolean) => {
    setIsBuildingState(building);
    if (!building) {
      setBuildProgressValue(0);
      setBuildMessageValue('');
    }
  }, []);

  // update filter (partial update)
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // reset filter ke default
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  // clear semua data - mulai dari awal lagi
  const clearAll = useCallback(() => {
    setRawFiles({} as Record<FileKey, string>);
    setFileValidations({} as Record<FileKey, ValidationResult | null>);
    setDatasetsState(null);
    setOrderMartState([]);
    setDataQuality(null);
    setBuildTimestamp(null);
    setFiltersState(defaultFilters);
  }, []);

  return (
    <DataContext.Provider
      value={{
        rawFiles,
        fileValidations,
        datasets,
        orderMart,
        dataQuality,
        buildTimestamp,
        isBuilding,
        buildProgress,
        buildMessage,
        filters,
        setRawFile,
        setFileValidation,
        setDatasets,
        setOrderMart,
        setBuildProgress,
        setIsBuilding,
        setFilters,
        resetFilters,
        clearAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

// hook buat akses data context
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData harus dipake di dalam DataProvider bro!');
  }
  return context;
}
