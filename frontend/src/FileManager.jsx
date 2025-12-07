import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_ENDPOINTS, cn } from "./lib/utils";
import { FileText, Upload, Trash2, Eye, ArrowLeft, File, Download, X } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

const FileManager = () => {
  const { roomId } = useParams();
  const userName = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.GET_FILES(roomId), {
          method: "GET",
        });
        if (!response.ok) throw new Error("Failed to fetch files");
        const data = await response.json();
        setFiles(data.files || []);
      } catch (err) {
        toast.error("Failed to fetch files. Please try again later.");
      }
    };
    fetchFiles();
  }, [roomId]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file || !fileName) {
      toast.error("File and name are required");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", fileName);
    formData.append("userName", userName);
    formData.append("userId", userId);

    try {
      const response = await fetch(API_ENDPOINTS.UPLOAD_FILE(roomId), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload file");
      
      // Refresh files list
      const filesResponse = await fetch(API_ENDPOINTS.GET_FILES(roomId));
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      setFile(null);
      setFileName("");
      toast.success("File uploaded successfully!");
    } catch (err) {
      toast.error("Error uploading file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      const response = await fetch(API_ENDPOINTS.DELETE_FILE(fileId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to delete file");
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      toast.success("File deleted successfully");
    } catch (err) {
      toast.error("Failed to delete file. Please try again.");
    }
  };

  const handleViewFile = async (fileId) => {
    try {
      const response = await fetch(API_ENDPOINTS.VIEW_FILE(fileId), { method: "GET" });
      if (!response.ok) throw new Error("Failed to fetch file for viewing");
      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, "_blank");
      toast.success("File opened in new tab");
    } catch (err) {
      toast.error("Error viewing file. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen w-full bg-bg-canvas text-fg-primary font-sans flex flex-col items-center py-12 px-6">
      <ToastContainer position="top-right" theme={theme} />
      
      <div className="w-full max-w-4xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/room/${roomId}`)}
              className="p-2 rounded-xl hover:bg-bg-surface text-fg-secondary hover:text-fg-primary transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="font-serif text-3xl font-medium">Files</h1>
              <p className="text-fg-secondary">Manage and share resources</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Upload Card */}
          <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-sm lg:col-span-1 sticky top-6">
            <h2 className="font-serif text-lg font-medium mb-4 flex items-center gap-2">
              <Upload size={20} className="text-accent-brand" />
              Upload File
            </h2>
            
            <form onSubmit={handleFileUpload} className="flex flex-col gap-4">
              <div className="relative group">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200",
                    file 
                      ? "border-accent-brand bg-accent-brand/5" 
                      : "border-border-subtle hover:border-accent-brand/50 hover:bg-bg-canvas"
                  )}
                >
                  {file ? (
                    <div className="flex flex-col items-center text-center p-2">
                      <FileText size={24} className="text-accent-brand mb-2" />
                      <span className="text-sm font-medium text-fg-primary truncate max-w-[200px]">{file.name}</span>
                      <span className="text-xs text-fg-secondary">Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <Upload size={24} className="text-fg-secondary mb-2 group-hover:text-accent-brand transition-colors" />
                      <span className="text-sm font-medium text-fg-primary">Choose a file</span>
                      <span className="text-xs text-fg-secondary">or drag and drop</span>
                    </div>
                  )}
                </label>
              </div>

              {file && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-fg-secondary ml-1">File Name</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200 text-sm"
                    placeholder="Enter file name"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full py-3 rounded-xl bg-accent-brand text-white font-medium shadow-lg shadow-accent-brand/25 hover:shadow-xl hover:shadow-accent-brand/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </form>
          </div>

          {/* Files List */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {files.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-fg-secondary bg-bg-surface border border-border-subtle rounded-3xl"
                  >
                    <File size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No files shared yet</p>
                  </motion.div>
                ) : (
                  files.map((file) => (
                    <motion.div
                      key={file.id}
                      variants={itemVariants}
                      layout
                      className="group bg-bg-surface border border-border-subtle rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="h-10 w-10 rounded-xl bg-bg-canvas flex items-center justify-center text-fg-secondary group-hover:text-accent-brand transition-colors shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-fg-primary truncate">{file.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-fg-secondary">
                            <span>{file.userName || "Unknown"}</span>
                            <span>•</span>
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleViewFile(file.id)}
                          className="p-2 rounded-lg hover:bg-bg-canvas text-fg-secondary hover:text-accent-brand transition-colors"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-fg-secondary hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
