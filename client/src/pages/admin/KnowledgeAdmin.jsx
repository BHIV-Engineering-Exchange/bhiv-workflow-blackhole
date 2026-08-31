import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { BookOpen, Database, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, FileText, User, Layers, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KnowledgeAdmin = () => {
    const [formData, setFormData] = useState({
        chatgptContent: '',
        productId: 'BHIV',
        individualId: '',
        datasetType: 'engineering_context'
    });
    const [status, setStatus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [responseDetails, setResponseDetails] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (value) => {
        setFormData({ ...formData, datasetType: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus('Submitting to Governed Ingestion Engine...');
        setResponseDetails(null);

        try {
            const token = localStorage.getItem('WorkflowToken');
            const response = await axios.post(`${API_URL}/knowledge/ingest`, formData, {
                headers: { 
                    'x-auth-token': token,
                    'Authorization': `Bearer ${token}`
                }
            });
            setStatus('Success');
            setResponseDetails(response.data);
        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const charCount = formData.chatgptContent.length;
    const wordCount = formData.chatgptContent.trim() ? formData.chatgptContent.trim().split(/\s+/).length : 0;

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-5xl">
            {/* ========== PAGE HEADER ========== */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Administration</h1>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold">
                            Live iPad Intake
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Governed intake interface for Akash to submit product knowledge, architecture decisions, and individual candidate context into the canonical RAG store.
                    </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border text-xs font-medium text-muted-foreground self-start sm:self-auto">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Schema & Provenance Validated</span>
                </div>
            </div>

            {/* ========== INGESTION FORM CARD ========== */}
            <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Database className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Dataset Ingestion Pipeline</CardTitle>
                                <CardDescription className="text-xs">
                                    Paste raw ChatGPT conversation transcripts or structured specifications for automated PARIKSHAK ingestion.
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* CHATGPT CONTENT TEXTAREA */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="chatgptContent" className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-foreground">
                                    <FileText className="h-3.5 w-3.5 text-primary" />
                                    ChatGPT Conversation / Knowledge Content
                                </Label>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                    {wordCount} words | {charCount} chars
                                </span>
                            </div>

                            <Textarea
                                id="chatgptContent"
                                name="chatgptContent"
                                rows={10}
                                className="font-mono text-sm leading-relaxed"
                                placeholder="Paste structured markdown, ChatGPT conversation, or architectural specification text here..."
                                value={formData.chatgptContent}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* METADATA FORM FIELDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Product ID */}
                            <div className="space-y-2">
                                <Label htmlFor="productId" className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-foreground">
                                    <Layers className="h-3.5 w-3.5 text-primary" />
                                    Product / Build ID
                                </Label>
                                <Input
                                    id="productId"
                                    type="text"
                                    name="productId"
                                    className="font-medium"
                                    value={formData.productId}
                                    onChange={handleChange}
                                    placeholder="e.g. BHIV, PARIKSHAK, TANTRA"
                                    required
                                />
                            </div>

                            {/* Individual ID */}
                            <div className="space-y-2">
                                <Label htmlFor="individualId" className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-foreground">
                                    <User className="h-3.5 w-3.5 text-primary" />
                                    Individual / Candidate ID
                                </Label>
                                <Input
                                    id="individualId"
                                    type="text"
                                    name="individualId"
                                    className="font-medium"
                                    value={formData.individualId}
                                    onChange={handleChange}
                                    placeholder="Optional (e.g. Rudra Parmeshwar)"
                                />
                            </div>

                            {/* Dataset Type */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-foreground">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    Dataset Type
                                </Label>
                                <Select value={formData.datasetType} onValueChange={handleSelectChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select dataset type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="engineering_context">Engineering Context</SelectItem>
                                        <SelectItem value="architecture_decision">Architectural Decision</SelectItem>
                                        <SelectItem value="canonical_decision">Canonical Decision</SelectItem>
                                        <SelectItem value="product_specs">Product Specifications</SelectItem>
                                        <SelectItem value="review_packet">Review Packet</SelectItem>
                                        <SelectItem value="code_packet">Code Packet</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <Button
                            type="submit"
                            disabled={isSubmitting || !formData.chatgptContent.trim()}
                            className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Send className="h-4 w-4" />
                            <span>{isSubmitting ? 'Submitting to Ingestion Engine...' : 'Submit to Governed Ingestion'}</span>
                        </Button>
                    </form>

                    {/* STATUS MESSAGE */}
                    {status && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 border ${
                            status.startsWith('Error') 
                                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}>
                            {status.startsWith('Error') ? (
                                <AlertCircle className="h-5 w-5 shrink-0" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 shrink-0" />
                            )}
                            <span className="text-xs font-semibold">{status}</span>
                        </div>
                    )}

                    {/* PROVENANCE PREVIEW CARD */}
                    {responseDetails && (
                        <Card className="bg-muted/40 border">
                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/20">
                                <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                    Ingestion Provenance & Lineage Reference:
                                </CardTitle>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                    {responseDetails.validation_status || responseDetails.status || 'VALIDATED'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-4">
                                <pre className="p-4 bg-slate-950 text-emerald-400 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed border border-slate-800">
                                    {JSON.stringify(responseDetails, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default KnowledgeAdmin;
