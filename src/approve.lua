rex.action{
  name = "pi_sudo_approval",
  title = "Pi sudo approval",
  args = { request = "string" },
  run = function(_, args)
    local answer = rex.ui.input{
      title = "Allow Pi to run as root? " .. args.request,
      placeholder = "Type approve to run the command",
      confirm = "Confirm",
      timeout = 90,
    }
    return answer == "approve"
  end,
}
