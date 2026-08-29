import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/lib/api';

const KnowledgeAdmin = () => {
    const [formData, setFormData] = useState({
        chatgptContent: '',
        productId: 'default_tenant',
        individualId: '',
        datasetType: 'engineering_context'
    });
    const [status, setStatus] = useState('');
    const [responseDetails, setResponseDetails] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('Submitting...');
        setResponseDetails(null);
        try {
            const response = await axios.post(`${API_URL}/knowledge/ingest`, formData, {
                headers: { 'x-auth-token': localStorage.getItem('WorkflowToken') }
            });
            setStatus('Success');
            setResponseDetails(response.data);
        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.response?.data?.message || err.message}`);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto flex flex-col h-full bg-slate-50 dark:bg-slate-900 min-h-screen">
            <h1 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">Knowledge Administration</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">ChatGPT Conversation Content</label>
                    <textarea
                        name="chatgptContent"
                        rows={10}
                        className="p-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                        placeholder="Paste raw structured markdown/conversation here..."
                        value={formData.chatgptContent}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Product / Build ID</label>
                        <input
                            type="text"
                            name="productId"
                            className="p-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            value={formData.productId}
                            onChange={handleChange}
                            placeholder="e.g. bhiv-workflow"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Individual (User ID)</label>
                        <input
                            type="text"
                            name="individualId"
                            className="p-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            value={formData.individualId}
                            onChange={handleChange}
                            placeholder="User ID (optional)"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dataset Type</label>
                        <select
                            name="datasetType"
                            className="p-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            value={formData.datasetType}
                            onChange={handleChange}
                        >
                            <option value="engineering_context">Engineering Context</option>
                            <option value="architectural_rules">Architectural Rules</option>
                            <option value="product_specs">Product Specs</option>
                        </select>
                    </div>
                </div>

                <button
                    type="submit"
                    className="mt-4 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition-colors"
                >
                    Submit to Governed Ingestion
                </button>

                {status && (
                    <div className={`p-4 mt-2 rounded-md ${status.startsWith('Error') ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'} dark:bg-opacity-20`}>
                        {status}
                    </div>
                )}

                {responseDetails && (
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-md overflow-x-auto text-xs font-mono border border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold mb-2 text-slate-800 dark:text-slate-200">Ingestion Provenance Reference:</h3>
                        <pre className="text-slate-700 dark:text-slate-300">{JSON.stringify(responseDetails, null, 2)}</pre>
                    </div>
                )}
            </form>
        </div>
    );
};

export default KnowledgeAdmin;
