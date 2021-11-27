#include "Config.hpp"

Config::Config(const RuntimeOptions &ro) : RuntimeOptions(ro){};
Config::Config(RuntimeOptions &&ro) : RuntimeOptions(std::move(ro)){};
const string &Config::version() const { return this->_version; }
const vector<shared_ptr<Generator>> &Config::generators() const {
  return this->_generators;
}