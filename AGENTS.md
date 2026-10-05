<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Wallet balances change only through SECURITY DEFINER SQL functions (credit_wallet, admin_*, claim_video_reward, request_withdrawal); clients never get UPDATE on profiles — prevents self-crediting.
- M-Pesa STK push runs in src/lib/mpesa.functions.ts; Safaricom callback lands at /api/public/mpesa-callback and only updates payments we created (matched by CheckoutRequestID); activation itself always needs admin approval.
- Survey rewards come from the CPX Research postback at /api/public/cpx-postback, verified by md5 hash and deduplicated by trans_id.
