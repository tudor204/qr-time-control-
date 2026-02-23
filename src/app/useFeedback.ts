import { useState, useCallback, useRef } from 'react';

export interface Feedback {
    type: 'success' | 'error';
    msg: string;
}

export const useFeedback = () => {
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const timeoutRef = useRef<any>(null);

    const showFeedback = useCallback((msg: string, type: 'success' | 'error' = 'success', duration: number = 3000) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setFeedback({ msg, type });

        if (duration > 0) {
            timeoutRef.current = setTimeout(() => {
                setFeedback(null);
                timeoutRef.current = null;
            }, duration);
        }
    }, []);

    const clearFeedback = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setFeedback(null);
    }, []);

    return {
        feedback,
        showFeedback,
        clearFeedback
    };
};
