import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { FileData } from '../types';

interface FileUploaderProps {
  onUpload: (files: FileData[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 5
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError("분석할 파일을 업로드해주세요.");
      return;
    }

    const fileDataPromises = files.map(async (file) => {
      return new Promise<FileData>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            name: file.name,
            mimeType: file.type,
            base64
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const fileData = await Promise.all(fileDataPromises);
    onUpload(fileData);
  };

  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div className="p-4 bg-indigo-50 rounded-full text-indigo-500 mb-4">
            <Upload size={32} />
          </div>
          <p className="text-lg font-medium text-slate-700">진단 결과 리포트 업로드</p>
          <p className="text-slate-500 text-sm mt-1">이미지(JPG, PNG) 또는 PDF 파일을 드래그하거나 클릭하여 선택하세요.</p>
          <p className="text-slate-400 text-xs mt-2">(파일은 1개만 업로드해주세요)</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-700">업로드된 파일 ({files.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 overflow-hidden">
                  <File size={18} className="text-indigo-500 shrink-0" />
                  <span className="text-sm text-slate-600 truncate">{file.name}</span>
                </div>
                <button onClick={() => removeFile(index)} className="text-slate-400 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleAnalyze}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95"
      >
        AI 심층 분석 시작하기
      </button>
    </div>
  );
};

export default FileUploader;
