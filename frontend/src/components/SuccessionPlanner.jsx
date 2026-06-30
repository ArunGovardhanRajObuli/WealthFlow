import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Trash2, Link as LinkIcon, Edit2, Check, X, AlertTriangle, Layers, Users } from 'lucide-react';
import CustomSelect from './ui/CustomSelect';

function SuccessionPlanner() {
  const queryClient = useQueryClient();
  const { data: d1, isLoading: l1, error: e1 } = useQuery({ queryKey: ['succession-summary'], queryFn: () => fetch('/api/succession-summary').then(r=>r.json()) });
  const { data: d2, isLoading: l2 } = useQuery({ queryKey: ['assignable-assets'], queryFn: () => fetch('/api/assignable-assets').then(r=>r.json()) });
  const { data: d3, isLoading: l3 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()) });

  const loading = l1 || l2 || l3;
  const error = e1 ? 'Failed to load succession data.' : null;
  const data = d1;
  const assignableAssets = d2?.assets || [];
  const familyMembers = d3?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editShare, setEditShare] = useState('');
  const [form, setForm] = useState({ family_member_id:'', selectedAsset:'', sharePercent:'100', notes:'' });

  const addMut = useMutation({
    mutationFn: (newNominee) => fetch('/api/nominees', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newNominee) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['succession-summary'] }); setShowForm(false); setForm({family_member_id:'',selectedAsset:'',sharePercent:'100',notes:''}); }
  });

  const delMut = useMutation({
    mutationFn: (id) => fetch(`/api/nominees/${id}`,{method:'DELETE'}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['succession-summary'] })
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/nominees/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['succession-summary'] }); setEditingId(null); }
  });

  const handleAdd = () => {
    let assetType = 'General';
    let assetId = null;
    let assetDescription = 'General Estate Coverage';
    
    if (form.selectedAsset && form.selectedAsset !== 'all') {
       const [type, id, desc] = form.selectedAsset.split('||');
       assetType = type;
       assetId = parseInt(id);
       assetDescription = desc;
    }

    const selectedMember = familyMembers.find(fm => fm.id.toString() === form.family_member_id);
    const sharePercent = Math.min(100, Math.max(1, parseFloat(form.sharePercent)));
    if (isNaN(sharePercent)) return;

    const existingSharesForAsset = (data?.nominees || [])
      .filter(n => n.assetType === assetType && n.assetId === assetId)
      .reduce((sum, n) => sum + n.sharePercent, 0);

    if (existingSharesForAsset + sharePercent > 100) {
      alert(`Cannot exceed 100% allocation. Currently allocated: ${existingSharesForAsset}%`);
      return;
    }

    addMut.mutate({
      family_member_id: parseInt(form.family_member_id),
      name: selectedMember ? selectedMember.name : 'Unknown',
      relationship: selectedMember ? selectedMember.role : 'Unknown',
      assetType,
      assetId,
      assetDescription,
      sharePercent,
      notes: form.notes
    });
  };

  const handleDelete = (id) => { 
    if(!window.confirm("Remove this nominee assignment?")) return;
    delMut.mutate(id);
  };

  const handleEditInit = (n) => {
    setEditingId(n.id);
    setEditShare(n.sharePercent.toString());
  };

  const handleEditSave = (id) => {
    const sharePercent = parseFloat(editShare);
    if (isNaN(sharePercent) || sharePercent <= 0) return;
    editMut.mutate({ id, data: { sharePercent } });
  };

  if (loading && !data) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Loading succession matrix...</p></div>;

  const completenessColor = (data?.completeness||0) === 100 ? '#10b981' : (data?.completeness||0) >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Succession Matrix</h2>
          <p>Map nominees directly to your active assets</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>
          <UserPlus size={16} style={{marginRight:'6px'}}/> {showForm ? 'Cancel Mapping' : 'Map New Nominee'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{padding:'24px',marginBottom:'24px', borderLeft:'4px solid #10b981'}}>
          <h3 style={{marginBottom:'16px'}}>Link Nominee to Asset</h3>
          <div className="grid-2" style={{gap:'16px',marginBottom:'16px'}}>
            <div className="field-group" style={{gridColumn:'span 2'}}>
              <label>Select Nominee (Family Estate Entity)</label>
              <CustomSelect required value={form.family_member_id} onChange={e=>setForm({...form,family_member_id:e.target.value})} className="field-input">
                <option value="">-- Select Nominee --</option>
                {familyMembers.map(fm => <option key={fm.id} value={fm.id}>{fm.name} ({fm.role})</option>)}
              </CustomSelect>
            </div>
            
            <div className="field-group" style={{gridColumn:'span 2'}}>
              <label>Select Asset from Portfolio</label>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <LinkIcon size={16} color="#10b981" />
                <CustomSelect value={form.selectedAsset} onChange={e=>setForm({...form,selectedAsset:e.target.value})} className="field-input">
                  <option value="">-- Select an active asset --</option>
                  <option value="all">Universal / General Estate Coverage</option>
                  {assignableAssets.filter(a => {
                      const existingShares = (data?.nominees || [])
                          .filter(n => n.assetType === a.type && n.assetId === a.id)
                          .reduce((sum, n) => sum + n.sharePercent, 0);
                      return existingShares < 100;
                  }).map(a => (
                    <option key={`${a.type}-${a.id}`} value={`${a.type}||${a.id}||${a.description}`}>
                      {a.type} — {a.description} (₹{Number(a.value).toLocaleString('en-IN')})
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            <div className="field-group"><label>Share (%)</label><input type="number" min="1" max="100" placeholder="100" value={form.sharePercent} onChange={e=>setForm({...form,sharePercent:e.target.value})} className="field-input" /></div>
            <div style={{display:'flex', alignItems:'flex-end'}}>
              <button onClick={handleAdd} disabled={!form.family_member_id || !form.selectedAsset} className={`btn ${(!form.family_member_id || !form.selectedAsset) ? '' : 'btn-success'}`} style={{width:'100%', padding:'12px', background: (!form.family_member_id || !form.selectedAsset) ? 'rgba(255,255,255,0.05)' : undefined, color: (!form.family_member_id || !form.selectedAsset) ? 'var(--text-muted)' : undefined}}>Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="stat-grid" style={{marginBottom:'24px'}}>
            <div className="stat-card" style={{'--stat-accent': completenessColor, '--stat-color': completenessColor}}>
              <div className="stat-card-icon"><ShieldCheck size={20}/></div>
              <div className="stat-card-label">Estate Completeness</div>
              <div className="stat-card-value">{data.completeness}%</div>
              <div className="stat-card-sub">Portfolio explicitly covered</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#f59e0b', '--stat-color':'#f59e0b'}}>
              <div className="stat-card-icon"><Layers size={20}/></div>
              <div className="stat-card-label">Total Assets Detected</div>
              <div className="stat-card-value">{data.totalAssets}</div>
              <div className="stat-card-sub">Across all hubs</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#3b82f6', '--stat-color':'#3b82f6'}}>
              <div className="stat-card-icon"><Users size={20}/></div>
              <div className="stat-card-label">Active Nominees</div>
              <div className="stat-card-value">{data.nominees?.length || 0}</div>
              <div className="stat-card-sub">Individuals assigned</div>
            </div>
          </div>

          <div className="grid-2" style={{gap:'24px'}}>
            <div className="glass-panel" style={{padding:'24px'}}>
              <h3 style={{marginBottom:'16px'}}>Coverage Assessment</h3>
              {data.coverage?.length === 0 && <p style={{fontSize:'13px', color:'var(--text-muted)'}}>No asset categories detected.</p>}
              {data.coverage?.map((c,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',marginBottom:'8px'}}>
                  <span style={{fontWeight:600,fontSize:'14px'}}>{c.type}</span>
                  <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>{c.count} Asset(s)</span>
                    <span style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:600,color:c.hasNominee?'#10b981':'#ef4444',background:c.hasNominee?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)'}}>
                      {c.hasNominee ? <ShieldCheck size={12}/> : null} {c.hasNominee?'Covered':'Exposed'}
                    </span>
                  </div>
                </div>
              ))}
              
              <div style={{padding:'16px',marginTop:'24px',borderRadius:'10px',background:`${completenessColor}10`, border:`1px solid ${completenessColor}30`, display:'flex', gap:'12px'}}>
                <div style={{fontSize:'20px'}}>{completenessColor === '#10b981' ? '✅' : '⚠️'}</div>
                <p style={{fontSize:'13px',color:completenessColor,margin:0, fontWeight:600}}>{data.recommendation}</p>
              </div>
            </div>

            <div className="glass-panel" style={{padding:'24px'}}>
              <h3 style={{marginBottom:'16px'}}>Active Assignments ({data.nominees?.length || 0})</h3>
              {data.nominees?.length === 0 && <p style={{fontSize:'13px', color:'var(--text-muted)'}}>No nominees mapped yet. Your estate is exposed to probate delays.</p>}
              
              {data.nominees?.map(n => (
                <div key={n.id} style={{padding:'14px',background:'rgba(255,255,255,0.02)',borderRadius:'10px',marginBottom:'12px', borderLeft:`3px solid #3b82f6`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <h4 style={{fontSize:'15px',marginBottom:'4px'}}>{n.name} <span style={{fontSize:'10px', background:'rgba(255,255,255,0.05)', padding:'2px 8px', borderRadius:'12px', color:'var(--text-muted)', verticalAlign:'middle', marginLeft:'6px'}}>{n.relationship}</span></h4>
                      <p style={{fontSize:'12px',color:'var(--text-secondary)',margin:0, display:'flex', alignItems:'center', gap:'6px'}}>
                        <LinkIcon size={12} color="#10b981" /> {n.assetType} — {n.assetDescription || 'Universal Assignment'}
                      </p>
                    </div>
                    
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      {editingId === n.id ? (
                         <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                           <input type="number" value={editShare} onChange={e=>setEditShare(e.target.value)} style={{width:'50px', padding:'4px', background:'rgba(0,0,0,0.3)', border:'1px solid var(--accent-emerald)', color:'#10b981', borderRadius:'4px', fontSize:'12px', fontWeight:700, textAlign:'center'}} />
                           <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
                           <button onClick={()=>handleEditSave(n.id)} style={{background:'none', border:'none', color:'#10b981', cursor:'pointer', padding:'4px'}}><Check size={14}/></button>
                           <button onClick={()=>setEditingId(null)} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px'}}><X size={14}/></button>
                         </div>
                      ) : (
                        <>
                          <span style={{fontWeight:800, color:'#10b981', fontSize:'14px'}}>{n.sharePercent}%</span>
                          <button className="icon-btn" onClick={()=>handleEditInit(n)} ><Edit2 size={14}/></button>
                          <button className="icon-btn danger" onClick={()=>handleDelete(n.id)} ><Trash2 size={14}/></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default SuccessionPlanner;
