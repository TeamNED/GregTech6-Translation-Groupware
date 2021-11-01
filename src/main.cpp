#include <iostream>
#include <string>

#include "ReplacerConfig.hpp"

using std::string;

int main(int argc, char const *argv[]) {
  ReplacerConfig config(argc, argv);
  auto result = config.generate();
  return 0;
}