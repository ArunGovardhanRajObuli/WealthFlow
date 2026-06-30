import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, FileText, Download, Upload, Trash2, Calendar, File, AlertTriangle, Users, Layers } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './ui/CustomSelect';

function DocumentVault() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('insurance');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [error, setError] = useState('');
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null });
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('all');

  const { data: d2 } = useQuery({ queryKey: ['assignable-assets'], queryFn: () => fetch('/api/assignable-assets').then(r=>r.json()) });
  const { data: d3 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()) });
  const assignableAssets = d2?.assets || [];
  const familyMembers = d3?.data || [];

  const { data: docsData, isLoading: loading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    }
  });

  const documents = React.useMemo(() => docsData?.data || [], [docsData?.data]);

  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Network error');
      }
      return res.json();
    },
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setExpiryDate('');
      setFamilyMemberId('');
      setSelectedAsset('all');
      setUploadStatus('success');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setTimeout(() => setUploadStatus('idle'), 3000);
    },
    onError: (err) => {
      setError(err.message);
      setUploadStatus('idle');
    }
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) return;
    
    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    formData.append('category', category);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    if (familyMemberId) formData.append('familyMemberId', familyMemberId);
    if (selectedAsset && selectedAsset !== 'all') {
       const [type, id] = selectedAsset.split('||');
       formData.append('assetId', id);
       formData.append('assetType', type);
    }

    uploadMutation.mutate(formData);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const deleteDoc = (id) => {
    setConfirmState({ isOpen: true, id });
  };

  const executeDelete = () => {
    if (confirmState.id) {
      deleteMutation.mutate(confirmState.id);
    }
    setConfirmState({ isOpen: false, id: null });
  };

  const getCategoryColor = (cat) => {
      switch(cat) {
          case 'insurance': return 'var(--accent-sapphire)';
          case 'property': return 'var(--accent-emerald)';
          case 'identity': return '#f59e0b';
          default: return 'var(--text-secondary)';
      }
  };

  const expiringDocs = useMemo(() => {
    return documents.filter(d => {
        if (!d.expiryDate) return false;
        const daysLeft = (new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
        return daysLeft > 0 && daysLeft <= 30; // Expiring in next 30 days
    });
  }, [documents]);

  const handleSecureDownload = async (url, filename) => {
    try {
      const cleanUrl = url.replace(/^http:\/\/localhost:\d+/, '');
      const res = await fetch(cleanUrl);
      if (!res.ok) throw new Error('Download failed or Unauthorized');
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Secure download error:', err);
      alert('Secure download failed. Please ensure you are authenticated.');
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <ConfirmationModal 
        isOpen={confirmState.isOpen} 
        title="Delete Document" 
        message="Are you sure you want to permanently delete this document from the vault?" 
        onConfirm={executeDelete} 
        onCancel={() => setConfirmState({ isOpen: false, id: null })} 
      />
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="var(--accent-emerald)" />
            The Digital Safe
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            End-to-end encrypted vault for health policies, property deeds, and term life bonds.
          </p>
        </div>
      </div>

      {expiringDocs.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <AlertTriangle size={24} color="var(--accent-coral)" />
              <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--accent-coral)' }}>Urgent: Documents Expiring Soon</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {expiringDocs.map(d => d.title).join(', ')} will expire within the next 30 days. Renew immediately.
                  </p>
              </div>
          </div>
      )}

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Upload Form */}
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ margin: '0 0 16px 0' }}>Upload to Safe</h4>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="field-group">
                    <label>Document Title</label>
                    <input type="text" className="field-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. HDFC Health Optima 2024" />
                </div>
                
                <div className="field-group">
                    <label>Category</label>
                    <CustomSelect className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="insurance">Insurance Policy</option>
                        <option value="property">Property Deed / Title</option>
                        <option value="identity">Identity / Tax (PAN/Aadhar)</option>
                        <option value="bonds">FDs / Sovereign Bonds</option>
                        <option value="other">Other</option>
                    </CustomSelect>
                </div>

                <div className="field-group">
                    <label>Expiry / Renewal Date (Optional)</label>
                    <input type="date" className="field-input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>

                <div className="field-group">
                    <label>Link to Family Member</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} color="var(--text-muted)" />
                        <CustomSelect className="field-input" value={familyMemberId} onChange={e => setFamilyMemberId(e.target.value)}>
                            <option value="">-- No Association --</option>
                            {familyMembers.map(fm => (
                                <option key={fm.id} value={fm.id}>{fm.name}</option>
                            ))}
                        </CustomSelect>
                    </div>
                </div>

                <div className="field-group">
                    <label>Link to Asset</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={16} color="var(--text-muted)" />
                        <CustomSelect className="field-input" value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                            <option value="all">-- No Association --</option>
                            {assignableAssets.map(a => (
                                <option key={a.type + '||' + a.id} value={a.type + '||' + a.id}>
                                    {a.type}: {a.description}
                                </option>
                            ))}
                        </CustomSelect>
                    </div>
                </div>

                <div className="field-group">
                    <label>File (PDF/Image)</label>
                    <input type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} required style={{
                        width: '100%', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)'
                    }} />
                </div>

                {error && <div style={{ color: 'var(--accent-coral)', fontSize: '12px' }}>{error}</div>}

                <button type="submit" className="btn primary" disabled={uploadStatus === 'uploading'} style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                    <Upload size={16} />
                    {uploadStatus === 'uploading' ? 'Encrypting & Uploading...' : 'Secure Upload'}
                </button>
            </form>
        </div>

        {/* Document List */}
        <div>
            <h4 style={{ margin: '0 0 16px 0' }}>Vault Contents</h4>
            {loading ? <div style={{color:'var(--text-muted)'}}>Unlocking safe...</div> : documents.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Shield size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>The safe is empty.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {documents.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <File size={20} color={getCategoryColor(doc.category)} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{doc.title}</div>
                                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span style={{ textTransform: 'capitalize' }}>{doc.category}</span>
                                        {doc.family_member_name && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Users size={10} /> {doc.family_member_name}
                                            </span>
                                        )}
                                        {doc.asset_name && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Layers size={10} /> {doc.asset_name}
                                            </span>
                                        )}
                                        {doc.expiryDate && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: (new Date(doc.expiryDate) < new Date()) ? 'var(--accent-coral)' : 'var(--text-muted)' }}>
                                                <Calendar size={10} /> Exp: {doc.expiryDate}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleSecureDownload(doc.fileUrl, `Document_${doc.title}.pdf`)} className="btn icon-only" title="Secure Download" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Download size={16} color="var(--text-secondary)" />
                                </button>
                                <button className="icon-btn danger" onClick={() => deleteDoc(doc.id)} title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default DocumentVault;
