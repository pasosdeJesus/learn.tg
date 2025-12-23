'use client'

import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';

const CeloSupportStreamButton = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await axios.post('/api/claim-celo-ubi');
            setMessage(response.data.message || 'Success!');
        } catch (err) {
            const error = err as AxiosError<{ message: string }>;
            setIsError(true);
            if (error.response) {
                setMessage(error.response.data.message || 'An unknown error occurred.');
            } else {
                setMessage('An error occurred while sending the request.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="my-4 text-center">
            <Button onClick={handleClick} disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Claim 1 CELO daily UBI'}
            </Button>
            {message && (
                <p className={`mt-2 text-sm ${isError ? 'text-red-500' : 'text-green-500'}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default CeloSupportStreamButton;
