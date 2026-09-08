import React, { useState } from 'react';

interface StatusMessageCardProps {
  initialStatus?: string;
}

export const StatusMessageCard: React.FC<StatusMessageCardProps> = ({
  initialStatus = 'Available for afternoon care updates & medication checks.',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [draftStatus, setDraftStatus] = useState(initialStatus);

  const handleEditClick = () => {
    setDraftStatus(status);
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setDraftStatus(status);
    setIsEditing(false);
  };

  const handleSaveClick = () => {
    setStatus(draftStatus);
    setIsEditing(false);
  };

  return (
    <div className="bg-[#fdf2e8] rounded-2xl p-6 shadow-xs border border-[#ece1d7]/60">
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans text-sm font-semibold text-[#201b15]">
          About / Status
        </span>
        {!isEditing && (
          <button
            type="button"
            onClick={handleEditClick}
            className="text-[#983d1d] hover:underline font-sans text-xs font-semibold cursor-pointer"
          >
            Edit
          </button>
        )}
      </div>

      {!isEditing ? (
        <p className="font-sans text-sm text-[#56423c] italic leading-relaxed">
          "{status}"
        </p>
      ) : (
        <div className="mt-3">
          <input
            type="text"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            className="w-full p-2.5 bg-white rounded-lg border border-[#ece1d7] font-sans text-xs sm:text-sm text-[#201b15] focus:outline-none focus:ring-2 focus:ring-[#983d1d]/40"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={handleCancelClick}
              className="px-3 py-1 rounded-lg text-[#56423c] font-sans text-xs hover:bg-[#ece1d7] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="px-3 py-1 rounded-lg bg-[#983d1d] text-white font-sans text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
