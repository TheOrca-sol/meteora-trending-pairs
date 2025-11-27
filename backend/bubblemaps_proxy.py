"""
BubbleMaps Proxy Service
Fetches BubbleMaps data server-side to bypass iframe domain restrictions
"""

import requests
import logging

logger = logging.getLogger(__name__)


def get_bubblemaps_url(token_address: str) -> str:
    """
    Generate BubbleMaps embed URL that works from any domain

    Instead of embedding iframe directly (which is blocked by BubbleMaps for non-whitelisted domains),
    we return a URL that can be opened in a new tab.

    Args:
        token_address: Solana token mint address

    Returns:
        str: BubbleMaps URL
    """
    return f"https://app.bubblemaps.io/sol/token/{token_address}"


def fetch_bubblemaps_data(token_address: str) -> dict:
    """
    Attempt to fetch BubbleMaps data server-side

    Note: This is a workaround and may not work if BubbleMaps blocks server requests
    or if they don't provide a public API.

    Args:
        token_address: Solana token mint address

    Returns:
        dict: Response with success status and data/error
    """
    try:
        url = f"https://app.bubblemaps.io/sol/token/{token_address}"

        # Try to fetch with headers that mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://meteora-trending-pairs.vercel.app/'
        }

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            logger.info(f"Successfully fetched BubbleMaps data for {token_address}")
            return {
                'success': True,
                'url': url,
                'message': 'BubbleMaps data available'
            }
        else:
            logger.warning(f"BubbleMaps returned status {response.status_code} for {token_address}")
            return {
                'success': False,
                'url': url,
                'error': f'BubbleMaps returned status {response.status_code}'
            }

    except Exception as e:
        logger.error(f"Error fetching BubbleMaps data: {e}")
        return {
            'success': False,
            'url': url,
            'error': str(e)
        }
