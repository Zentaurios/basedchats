'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from '@coinbase/onchainkit/identity'
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { verifyAdminSignature, checkAddressAuthorization } from '../actions/auth'
import { generateAuthMessage } from '../../../lib/auth-utils'

interface AdminAuthProps {
  onAuthSuccess: () => void
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnect } = useDisconnect()

  // Check authorization when address changes
  useEffect(() => {
    async function checkAuth() {
      if (!address) {
        setIsAuthorized(null)
        return
      }

      setIsCheckingAuth(true)
      try {
        const result = await checkAddressAuthorization(address)
        setIsAuthorized(result.isAuthorized)
      } catch (error) {
        console.error('Failed to check authorization:', error)
        setIsAuthorized(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [address])

  const handleAuthenticate = useCallback(async () => {
    if (!address) {
      setError('No wallet connected')
      return
    }

    if (!isAuthorized) {
      setError('This wallet address is not authorized for admin access')
      return
    }

    try {
      setIsAuthenticating(true)
      setError(null)

      // Generate SIWE-compatible message
      const message = generateAuthMessage(address)

      // Request signature from user
      const signature = await signMessageAsync({ message })

      // Verify signature on server
      const result = await verifyAdminSignature(address, signature, message)

      if (result.success) {
        onAuthSuccess()
      } else {
        setError(result.error || 'Authentication failed')
      }
    } catch (error: unknown) {
      console.error('Authentication error:', error)
      
      // Enhanced error handling with more specific messages
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.name === 'UserRejectedRequestError') {
          errorMessage = 'Please sign the message to authenticate';
        } else if (error.message.includes('Signature format error')) {
          errorMessage = 'Wallet signature issue. Try disconnecting and reconnecting your wallet.';
        } else if (error.message.includes('Invalid signature length')) {
          errorMessage = 'Signature compatibility issue. This wallet may not be fully supported. Try a different wallet.';
        } else if (error.message.includes('verification failed')) {
          errorMessage = 'Signature verification failed. Please try signing the message again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        // Log detailed error info for debugging
        console.log('Error details:', {
          name: error.name,
          message: error.message,
          address: address,
          walletConnected: isConnected
        });
      }
      
      setError(errorMessage);
    } finally {
      setIsAuthenticating(false)
    }
  }, [address, signMessageAsync, onAuthSuccess, isAuthorized, isConnected])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-base-blue">Admin Access</CardTitle>
            <CardDescription>
              Connect your authorized wallet and sign to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Connect your wallet to verify admin permissions
                </p>
                
                {/* Use OnchainKit Wallet Modal */}
                <div className="flex justify-center">
                  <Wallet>
                    <ConnectWallet className="w-full">
                      <span>Connect Wallet</span>
                    </ConnectWallet>
                    <WalletDropdown>
                      <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                        <Avatar />
                        <Name />
                        <Address />
                        <EthBalance />
                      </Identity>
                      <WalletDropdownDisconnect />
                    </WalletDropdown>
                  </Wallet>
                </div>
                
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Supports MetaMask, Coinbase Wallet, Phantom, and more
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-gray-10 dark:bg-gray-80 rounded-lg border">
                  <p className="text-sm font-medium">Connected Address:</p>
                  <p className="text-xs font-mono text-gray-60 dark:text-gray-30 break-all">
                    {address}
                  </p>
                </div>

                {isCheckingAuth ? (
                  <div className="p-3 bg-blue/10 border border-blue/20 rounded-lg">
                    <p className="text-sm text-blue font-medium">
                      🔍 Checking Authorization...
                    </p>
                    <p className="text-xs text-blue/80 mt-1">
                      Verifying wallet permissions...
                    </p>
                  </div>
                ) : isAuthorized === false ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-red/10 border border-red/20 rounded-lg">
                      <p className="text-sm text-red font-medium">
                        ⚠️ Unauthorized Wallet
                      </p>
                      <p className="text-xs text-red/80 mt-1">
                        This wallet address is not authorized for admin access.
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => disconnect()}
                        variant="secondary"
                        className="flex-1"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-green/10 border border-green/20 rounded-lg">
                      <p className="text-sm text-green font-medium">
                        ✅ Authorized Wallet
                      </p>
                      <p className="text-xs text-green/80 mt-1">
                        This wallet is authorized for admin access.
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => disconnect()}
                        variant="secondary"
                        className="flex-1"
                      >
                        Disconnect
                      </Button>
                      <Button 
                        onClick={handleAuthenticate}
                        loading={isAuthenticating}
                        disabled={isCheckingAuth || !isAuthorized}
                        variant="primary"
                        className="flex-1"
                      >
                        {isAuthenticating ? 'Signing...' : 'Sign In'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red/10 border border-red/20 rounded-lg">
                <p className="text-sm text-red">{error}</p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Only authorized wallet addresses can access the admin panel.
                OnchainKit Wallet Modal provides secure authentication.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
