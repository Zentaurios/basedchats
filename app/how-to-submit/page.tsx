"use client";

import { useOpenUrl } from "@coinbase/onchainkit/minikit";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

export default function HowToSubmit() {
  const openUrl = useOpenUrl();

  const handleOpenProfile = (username: string) => {
    openUrl(`https://warpcast.com/${username}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="w-full max-w-2xl mx-auto px-4 py-3">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-base-blue">BasedChats</h1>
          </div>
        </header>

        <main className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">How to Get Your Group Chat Featured</h2>
            <p className="text-muted-foreground">
              Want to see your group chat included in the BasedChats? Here&#39;s how to submit it for consideration.
            </p>
          </div>

          <div className="grid gap-6">
            {/* Method 1 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span className="bg-base-blue text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                  <span>Tag the Curators</span>
                </CardTitle>
                <CardDescription>
                  The easiest way to get noticed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Create a post about your group chat on Farcaster and tag{" "}
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-semibold text-base-blue hover:text-base-blue/80 bg-gray-400"
                    onClick={() => handleOpenProfile("thebaron")}
                  >
                    @thebaron
                  </Button>{" "}
                  or{" "}
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-semibold text-base-blue hover:text-base-blue/80 bg-gray-400"
                    onClick={() => handleOpenProfile("webb3fitty")}
                  >
                    @webb3fitty
                  </Button>{" "}
                  in a comment.
                </p>

                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Example post:</p>
                  <p className="text-sm text-muted-foreground italic">
                    &quot;Just started a new group chat for Base builders! We&#39;re discussing the latest in DeFi and sharing alpha.
                    Would love to have more builders join us! 🔵&quot;
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Then tag one of the curators in the comments.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Method 2 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span className="bg-base-blue text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                  <span>Direct Message</span>
                </CardTitle>
                <CardDescription>
                  For more detailed submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Message{" "}
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-semibold text-base-blue hover:text-base-blue/80 bg-gray-400"
                    onClick={() => handleOpenProfile("thebaron")}
                  >
                    @thebaron
                  </Button>{" "}
                  or{" "}
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-semibold text-base-blue hover:text-base-blue/80 bg-gray-400"
                    onClick={() => handleOpenProfile("webb3fitty")}
                  >
                    @webb3fitty
                  </Button>{" "}
                  directly on the Base App to request inclusion.
                </p>

                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Include in your message:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Link to your group chat post</li>
                    <li>• Brief description of your community</li>
                    <li>• Why it would be valuable for the Base ecosystem</li>
                    <li>• How active your group is</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>Community Guidelines</CardTitle>
                <CardDescription>
                  What we look for in featured group chats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-green mb-1">✓ We feature chats that are:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Active and engaging</li>
                      <li>• Welcoming to new members</li>
                      <li>• Building something valuable</li>
                      <li>• Following community standards</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-red mb-1">✗ We don&#39;t feature chats that:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Promote scams or harmful content</li>
                      <li>• Are primarily for trading/financial advice</li>
                      <li>• Have inactive or hostile communities</li>
                      <li>• Violate the Base App&#39;s community guidelines</li>
                      <li>• Are exclusively promotional</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
                <CardDescription>
                  Tips to increase your chances of being featured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="border-l-4 border-base-blue pl-4">
                    <h4 className="font-semibold mb-1">Be Authentic</h4>
                    <p className="text-sm text-muted-foreground">
                      Share genuine information about your community. Authenticity resonates with both curators and potential members.
                    </p>
                  </div>

                  <div className="border-l-4 border-base-blue pl-4">
                    <h4 className="font-semibold mb-1">Show Activity</h4>
                    <p className="text-sm text-muted-foreground">
                      Include recent messages or examples that demonstrate your group&#39;s engagement and value.
                    </p>
                  </div>

                  <div className="border-l-4 border-base-blue pl-4">
                    <h4 className="font-semibold mb-1">Be Patient</h4>
                    <p className="text-sm text-muted-foreground">
                      We review submissions regularly, but it may take some time. Continue building your community in the meantime.
                    </p>
                  </div>

                  <div className="border-l-4 border-base-blue pl-4">
                    <h4 className="font-semibold mb-1">Build on Base</h4>
                    <p className="text-sm text-muted-foreground">
                      Groups that are actively building on or supporting the Base ecosystem are prioritized.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground text-sm">
              Questions about the submission process? Feel free to reach out to our curators for clarification.
            </p>
            <p className="text-muted-foreground text-sm">
              This app was built with ❤️ by the Base community and not directly affiliated with Base, Coinbase, or the Base App.
            </p>
            <p className="text-muted-foreground text-sm">
              You can support the app by supporting the
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground border-blue-500"
                onClick={() => openUrl("https://base4everything.xyz/")}
              >
                Everything
              </Button>
              project.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
