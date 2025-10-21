import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { FileText, Upload, Trash2, Eye, ArrowLeft } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./contexts/ThemeContext";

const FileManager = () => {
  const { roomId } = useParams();
  const userName = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Colors from theme context, fallback to chat style
  const colors = theme.colors || {
    background: theme.name === "dark" ? "bg-neutral-900" : "bg-neutral-50",
    surface: theme.name === "dark" ? "bg-neutral-800" : "bg-white",
    accent: theme.name === "dark" ? "bg-yellow-900" : "bg-yellow-100",
    text: theme.name === "dark" ? "text-neutral-100" : "text-neutral-800",
    border: theme.name === "dark" ? "border-neutral-700" : "border-neutral-200",
    primary: theme.name === "dark" ? "text-yellow-400" : "text-yellow-700",
    secondary: theme.name === "dark" ? "bg-yellow-900" : "bg-yellow-50",
    icon: theme.name === "dark" ? "text-yellow-400" : "text-yellow-700",
    input: theme.name === "dark" ? "bg-neutral-800" : "bg-neutral-100",
  };

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
    setFile(selectedFile);
    setFileName(selectedFile ? selectedFile.name : "");
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file || !fileName) {
      setUploadMessage("File and name are required");
      toast.error("File and name are required");
      return;
    }
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
      const data = await response.json();
      setUploadMessage(data.message);

      // Refresh files list
      const filesResponse = await fetch(API_ENDPOINTS.GET_FILES(roomId));
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      setFile(null);
      setFileName("");
      toast.success("File uploaded successfully!");
    } catch (err) {
      setUploadMessage("Error uploading file");
      toast.error("Error uploading file. Please try again.");
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

  return (
    <div className={`fixed inset-0 min-h-screen min-w-screen w-screen h-screen flex flex-col items-center justify-center ${colors.background} ${colors.text} font-inter`}>
      <ToastContainer position="top-right" theme={theme.name === 'dark' ? 'dark' : 'light'} />
      <div className={`w-full max-w-2xl h-[95vh] mx-auto my-8 rounded-3xl shadow-lg ${colors.surface} px-8 py-8 flex flex-col gap-8`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <FileText size={32} className={colors.icon} />
            <div>
              <h1 className={`text-2xl font-semibold m-0 ${colors.text}`}>File Manager</h1>
              <span className={`text-base flex items-center gap-2 mt-1 ${colors.primary}`}>
                Room Files
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              title="Back to Chat"
              onClick={() => navigate(`/room/${roomId}`)}
              className={`rounded-xl p-2 ${colors.input} flex items-center border-none`}
            >
              <ArrowLeft size={22} className={colors.icon} />
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className={`rounded-2xl p-4 mb-2 flex flex-col gap-5 ${colors.input}`}>
          <div className="flex items-center gap-2 mb-2">
            <Upload size={20} className={colors.icon} />
            <span className={`font-medium text-base ${colors.primary}`}>Upload New File</span>
          </div>
          <form onSubmit={handleFileUpload} className="flex flex-col gap-3">
            <input
              type="text"
              value={fileName}
              readOnly
              placeholder="File name"
              className={`rounded-xl px-4 py-3 text-base outline-none transition border ${colors.border} ${colors.input} ${colors.text} shadow-sm`}
            />
            <input
              type="file"
              onChange={handleFileChange}
              className={`rounded-xl px-4 py-3 text-base outline-none transition border ${colors.border} ${colors.input} ${colors.text} shadow-sm`}
              required
            />
            <button
              type="submit"
              className="rounded-xl px-4 py-3 font-medium text-base flex items-center gap-2 shadow-sm bg-yellow-700 text-white hover:bg-yellow-800 transition"
            >
              <Upload size={20} />
              Upload File
            </button>
          </form>
          {uploadMessage && (
            <div className={`mt-2 p-2 rounded-lg font-semibold ${colors.background} ${colors.text}`}>
              {uploadMessage}
            </div>
          )}
        </div>

        {/* Files List */}
        <div className={`rounded-2xl p-4 min-h-[220px] max-h-[320px] overflow-y-auto flex flex-col gap-3 border ${colors.border} ${colors.input}`}>
          {files.length === 0 ? (
            <div className="text-lg text-center py-12" style={{ color: theme.name === "dark" ? "#FFD700" : "#0C1844" }}>
              No files uploaded yet
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className={`rounded-xl px-4 py-3 mb-1 shadow-sm max-w-[100%] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${colors.surface} border ${colors.border}`}
              >
                <div className="flex-1">
                  <h3 className={`font-bold text-lg mb-1 ${colors.primary}`}>{file.name}</h3>
                  <p className="text-sm" style={{ color: theme.name === "dark" ? "#FFD700" : "#0C1844" }}>
                    Uploaded by: {file.uploaded_by || 'User'} • {formatDate(file.uploaded_at || new Date())}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewFile(file.id)}
                    className="rounded-lg px-3 py-2 font-semibold flex items-center gap-2 shadow-sm bg-yellow-700 text-white hover:bg-yellow-800 transition"
                  >
                    <Eye size={18} />
                    View
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="rounded-lg px-3 py-2 font-semibold flex items-center gap-2 shadow-sm bg-red-600 text-white hover:bg-red-700 transition"
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManager;