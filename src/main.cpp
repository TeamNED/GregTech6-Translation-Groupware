#include <iostream>
#include <string>

#include "Replacer.hpp"
#include "config/ConfigParser.hpp"
#include "config/RuntimeOptions.hpp"

using std::string;

int main(int argc, char const *argv[]) {
  RuntimeOptions options(argc, argv);
  Config config =
      ConfigParser::parse_config_from_path(options.config_path().string());
  Replacer worker(config.generators());
  auto result = worker.generate_map();
  return 0;
}